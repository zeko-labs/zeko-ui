import { accountQuery, genesisConstantsQueryL1, runtimeConfigQuery } from "@zeko/graphql/mina"
import {
	fetchConfigQuery,
	finalizeDepositMutation,
	finalizeWithdrawalMutation,
	genesisConstantsQueryL2,
	provedForestQuery,
	sequencerPkQuery,
	submitDepositMutation,
	submitWithdrawalMutation
} from "@zeko/graphql/zeko"
import { AccountUpdate, Field, Mina, PublicKey, TokenId, type Types, UInt32, UInt64 } from "o1js"
import type { Client } from "urql"
import * as v from "valibot"
import { fromList, pushAction } from "./actions"
import { createGraphqlClient } from "./graphql"
import type {
	Config,
	Deposit,
	DepositWithState,
	InnerAction,
	InnerActionWithState,
	InnerWitness,
	OuterCommit,
	OuterWitness,
	Withdrawal
} from "./types"
import {
	BRIDGE_DEPLOY_BLOCK,
	depositAux,
	fetchActions,
	fetchActionsFromIndexer,
	fetchCommitAsePastWithdrawalDelay,
	fetchWitnessesFromAuxes,
	filterNulls,
	getNextDepositIndex,
	getNextWithdrawalIndex,
	refreshCache,
	withdrawalAux
} from "./utils"

export * from "./actions"
export * from "./graphql/index"
export * from "./types"

export class Bridge {
	constructor(
		private readonly config: Config,

		private readonly l1Client: Client,
		private readonly l1ArchiveClient: Client,
		private readonly l2Client: Client,
		private readonly l2ArchiveClient: Client,
		private readonly actionsApiClient: Client,

		public readonly l1AccountCreationFee: UInt64,
		public readonly l2AccountCreationFee: UInt64,

		public readonly outerPk: PublicKey,
		public readonly innerPk: PublicKey,
		public readonly outerHolders: PublicKey[],
		public readonly innerHolder: PublicKey,
		public readonly outerTokenOwner: PublicKey,
		public readonly sequencerPk: PublicKey,
		public readonly withdrawalDelay: UInt32
	) {}

	static async init(config: Config): Promise<Bridge> {
		const l1Client = createGraphqlClient(config.l1Url)
		const l1ArchiveClient = createGraphqlClient(config.l1ArchiveUrl)
		const actionsApiClient = createGraphqlClient(config.actionsApi)
		const l2Client = createGraphqlClient(config.zekoUrl)
		const l2ArchiveClient = createGraphqlClient(config.zekoArchiveUrl)

		const [fetchConfigResult, genesisConstantL2Result, genesisConstantL1Result, sequencerPkResult] =
			await Promise.all([
				l2Client.query(fetchConfigQuery, {}),
				l2Client.query(genesisConstantsQueryL2, {}),
				l1Client.query(genesisConstantsQueryL1, {}),
				l2Client.query(sequencerPkQuery, {})
			])

		const circuitsConfig = fetchConfigResult.data?.circuitsConfig
		if (!circuitsConfig) throw new Error("Circuits config not found")

		const l1AccountCreationFee = genesisConstantL1Result.data?.genesisConstants?.accountCreationFee
		if (!l1AccountCreationFee) throw new Error("L1 account creation fee not found")

		const l2AccountCreationFee = genesisConstantL2Result.data?.genesisConstants?.accountCreationFee
		if (!l2AccountCreationFee) throw new Error("L2 account creation fee not found")

		const sequencerPk = sequencerPkResult.data?.sequencerPk
		if (!sequencerPk) throw new Error("Sequencer public key not found")

		return new Bridge(
			config,
			l1Client,
			l1ArchiveClient,
			l2Client,
			l2ArchiveClient,
			actionsApiClient,
			UInt64.from(l1AccountCreationFee),
			UInt64.from(l2AccountCreationFee),
			PublicKey.fromBase58(circuitsConfig.zekoL1), // outerPk
			PublicKey.fromBase58(circuitsConfig.zekoL2), // innerPk
			circuitsConfig.holderAccountsL1.map((holder) => PublicKey.fromBase58(holder)), // outerHolders
			PublicKey.fromBase58(circuitsConfig.holderAccountL2), // innerHolder
			PublicKey.fromBase58(circuitsConfig.helperTokenOwnerL1), // outerTokenOwner
			PublicKey.fromBase58(sequencerPk),
			UInt32.from(circuitsConfig.withdrawalDelay)
		)
	}

	public setL1(): void {
		Mina.setActiveInstance(
			Mina.Network({
				mina: this.config.l1Url,
				archive: this.config.l1ArchiveUrl,
				networkId: this.config.l1Network
			})
		)
	}

	public setL2(): void {
		Mina.setActiveInstance(
			Mina.Network({
				mina: this.config.zekoUrl,
				archive: this.config.zekoUrl,
				networkId: this.config.l2Network
			})
		)
	}

	public async fetchCurrentSlot(): Promise<UInt32> {
		const { data } = await this.l1Client.query(runtimeConfigQuery, {})

		const result = v.safeParse(
			v.object({
				proof: v.object({ fork: v.object({ global_slot_since_genesis: v.number() }) }),
				genesis: v.object({ genesis_state_timestamp: v.string() })
			}),
			data?.runtimeConfig
		)
		if (!result.success) throw new Error("Invalid runtime config")

		const currentTimestamp = Date.now() / 1000
		const forkSlot = result.output.proof.fork.global_slot_since_genesis
		const genesisTimestamp = Date.parse(result.output.genesis.genesis_state_timestamp) / 1000

		return UInt32.from(Math.floor(forkSlot + (currentTimestamp - genesisTimestamp) / 180))
	}

	private async fetchAccount(
		client: Client,
		pk: PublicKey,
		tokenId?: Field
	): Promise<{ zkappState: string[] | null } | null> {
		const { data } = await client.query(accountQuery, {
			pk: pk.toBase58(),
			tokenId: tokenId ? TokenId.toBase58(tokenId) : null
		})
		if (!data) throw new Error("Error getting account data")
		return data.account
	}

	private async fetchUserDeposits(pk: PublicKey): Promise<Deposit[]> {
		const userOuterActions = await fetchActions(this.l1ArchiveClient, pk, BRIDGE_DEPLOY_BLOCK)

		return filterNulls(
			userOuterActions.map(({ action }) => {
				const [
					recipient1,
					recipient2,
					amount1,
					timeout1,
					holderAccount1,
					holderAccount2,
					outer1,
					outer2
				] = action

				if (
					!recipient1 ||
					!recipient2 ||
					!amount1 ||
					!timeout1 ||
					!holderAccount1 ||
					!holderAccount2 ||
					!outer1 ||
					!outer2
				)
					return null

				const recipient = PublicKey.fromFields([recipient1, recipient2])
				const amount = UInt64.fromFields([amount1])
				const timeout = UInt32.fromFields([timeout1])
				const holderAccountL1 = PublicKey.fromFields([holderAccount1, holderAccount2])
				const outerPk = PublicKey.fromFields([outer1, outer2])

				if (!outerPk.equals(this.outerPk).toBoolean()) return null

				if (!this.outerHolders.some((holder) => holder.equals(holderAccountL1).toBoolean()))
					return null

				return {
					recipient,
					amount,
					timeout,
					holderAccountL1
				}
			})
		)
	}

	private async fetchUserWithdrawals(pk: PublicKey): Promise<Withdrawal[]> {
		const userInnerActions = await fetchActions(this.l2ArchiveClient, pk)

		return filterNulls(
			userInnerActions.map(({ action }) => {
				const [recipient1, recipient2, amount1] = action

				if (!recipient1 || !recipient2 || !amount1) return null

				const recipient = PublicKey.fromFields([recipient1, recipient2])
				const amount = UInt64.fromFields([amount1])

				return {
					recipient,
					amount
				}
			})
		)
	}

	private async fetchInnerActions(): Promise<InnerAction[]> {
		const actions = await fetchActions(this.l2ArchiveClient, this.innerPk)

		return actions.map(
			({ index, beforeActionState, afterActionState, action, hash, timestamp }) => {
				if (action[0].equals(0).toBoolean()) {
					return {
						type: "witness",
						aux: action[1],
						action: { index, beforeActionState, afterActionState, action, hash, timestamp }
					}
				}
				throw new Error("Invalid inner action type")
			}
		)
	}

	private async pollQuery(key: string, pollPeriod = 5_000) {
		let provedForest: string | null = null
		let attempts = 0

		while (!provedForest) {
			if (attempts > (this.config.pollTimeout ?? 30_000) / pollPeriod) {
				throw new Error("Failed to fetch proved forest")
			}

			await new Promise((resolve) => setTimeout(resolve, pollPeriod))
			attempts++

			const resultResponse = await this.l2Client.query(provedForestQuery, { key })
			if (resultResponse.error) throw resultResponse.error
			provedForest = resultResponse.data?.provedForest ?? null
		}

		return (JSON.parse(provedForest) as Types.Json.AccountUpdate[]).map(AccountUpdate.fromJSON)
	}

	public async submitDeposit(
		feePayer: Mina.FeePayerSpec,
		{
			recipient,
			amount,
			timeout,
			holderAccountL1 = this.outerHolders[0]
		}: {
			recipient: PublicKey
			amount: UInt64
			timeout: UInt32
			holderAccountL1?: PublicKey
		}
	): Promise<Mina.Transaction<false, false>> {
		this.setL1()

		await refreshCache(feePayer)

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount)
			transferrer.body.actions = pushAction(transferrer.body.actions, [
				...recipient.toFields(),
				...amount.toFields(),
				...timeout.toFields(),
				...holderAccountL1.toFields(),
				...this.outerPk.toFields()
			])
		})

		const { data } = await this.l2Client.mutation(submitDepositMutation, {
			depositParams: {
				recipient: recipient.toBase58(),
				amount: amount.toString(),
				timeout: +timeout.toString(),
				holderAccountL1: holderAccountL1.toBase58(),
				children: "[]"
			}
		})
		if (!data?.request?.key) throw new Error("No key returned from mutation")

		const depositForest = await this.pollQuery(data.request.key)

		txn.transaction.accountUpdates.push(...depositForest)

		return txn
	}

	public async fetchSyncedOuterActionState(): Promise<{ state: Field; length: UInt32 }> {
		const innerAccount = await this.fetchAccount(this.l2Client, this.innerPk)

		if (!innerAccount || !innerAccount.zkappState) throw new Error("Inner account not found")
		const [state, length] = innerAccount.zkappState
		return {
			state: Field.from(state),
			length: UInt32.from(length)
		}
	}

	private async fetchDepositFinalizationWitnesses(pk: PublicKey) {
		const helperAccount = await this.fetchAccount(
			this.l2Client,
			pk,
			TokenId.derive(this.innerHolder)
		)

		const prevNextDeposit = helperAccount ? getNextDepositIndex(helperAccount) : UInt32.zero

		const deposits = (await this.fetchUserDeposits(pk)).map((deposit) => ({
			deposit,
			aux: depositAux(deposit)
		}))

		if (deposits.length === 0) return null

		const depositWitnesses = await fetchWitnessesFromAuxes(
			this.actionsApiClient,
			deposits.map(({ aux }) => aux.toString())
		)

		if (depositWitnesses.length === 0) return null

		const earliestBeforeState = depositWitnesses
			.sort((a, b) => a.index - b.index)
			.at(0)?.beforeActionState

		if (earliestBeforeState === undefined) return null

		const outerActions = await fetchActionsFromIndexer(this.actionsApiClient, {
			fromState: earliestBeforeState.toString()
		})

		const findMatchingDeposit = (action: OuterWitness) =>
			deposits.find(({ aux }) => aux.equals(action.aux).toBoolean())

		const myDepositIndex = outerActions.findIndex((action) => {
			if (action.type === "commit") return false

			const matchingDeposit = findMatchingDeposit(action)

			if (!matchingDeposit) return false

			if (prevNextDeposit.greaterThan(UInt32.from(action.index)).toBoolean()) return false

			return true
		})

		if (myDepositIndex === -1) return null

		const myDeposit = outerActions[myDepositIndex] as OuterWitness

		const nextCommitIndex = outerActions.findIndex((action) => {
			if (action.type !== "commit") return false

			if (
				action.synchronizedOuterActionStateLength
					.lessThanOrEqual(UInt32.from(myDeposit.index))
					.toBoolean()
			)
				return false

			return true
		})

		if (nextCommitIndex === -1) return null

		const nextCommit = outerActions[nextCommitIndex] as OuterCommit

		const depositParams = findMatchingDeposit(myDeposit)
		if (!depositParams) throw new Error("Unreachable: Did not find deposit parameters")

		const syncedOuterActionState = await this.fetchSyncedOuterActionState()

		const syncedOuterActionStateIndex = outerActions.findIndex(({ afterActionState }) =>
			afterActionState.equals(syncedOuterActionState.state).toBoolean()
		)

		if (syncedOuterActionStateIndex === -1 || syncedOuterActionStateIndex < nextCommitIndex)
			return null

		const aseElems = outerActions
			.slice(nextCommitIndex + 1, syncedOuterActionStateIndex + 1)
			.map(({ action }) => fromList([action]).hash)

		return {
			aseTarget: syncedOuterActionState,
			depositParams,
			helperAccount,
			witness: {
				prevNextDeposit: prevNextDeposit.toString(),
				checkAccepted: {
					elems: outerActions
						.slice(myDepositIndex, nextCommitIndex + 1)
						.map(({ action }) => ({ actions: action.map((a) => a.toString()) })),
					init: {
						depositIndex: myDeposit.index.toString(),
						orignalActionState: myDeposit.beforeActionState.toString(),
						params: {
							amount: depositParams.deposit.amount.toString(),
							recipient: depositParams.deposit.recipient.toBase58(),
							holderAccountL1: depositParams.deposit.holderAccountL1.toBase58(),
							timeout: +depositParams.deposit.timeout,
							children: "[]"
						}
					}
				},
				ase: {
					stmt: {
						length: syncedOuterActionState.length.sub(aseElems.length).toString(),
						actionState: nextCommit.afterActionState.toString()
					},
					fields: aseElems.map((elem) => elem.toString())
				}
			}
		}
	}

	public async finalizeDeposit(
		pk: PublicKey,
		fee: UInt64 = UInt64.zero,
		attempts = 5
	): Promise<Mina.Transaction<false, false>> {
		const prove = async (attempts: number) => {
			if (attempts === 0) throw new Error("Failed to prove deposit finalization")

			const witnesses = await this.fetchDepositFinalizationWitnesses(pk)

			if (!witnesses) throw new Error("Did not find any deposit to finalize")

			const { witness, depositParams, helperAccount, aseTarget } = witnesses

			const { data } = await this.l2Client.mutation(finalizeDepositMutation, {
				input: witness
			})

			if (!data?.request?.key) throw new Error("No key returned from mutation")
			const depositForest = await this.pollQuery(data.request.key)

			const currentSyncedOuterActionState = await this.fetchSyncedOuterActionState()

			if (currentSyncedOuterActionState.state.equals(aseTarget.state).toBoolean()) {
				return { depositForest, depositParams, helperAccount }
			}
			return await prove(attempts - 1)
		}

		const { depositForest, depositParams, helperAccount } = await prove(attempts)

		for (let i = 0; i < depositForest.length; i++) {
			if (!depositForest[i].publicKey.equals(pk).toBoolean()) continue

			depositForest[i].lazyAuthorization = { kind: "lazy-signature" }
		}

		this.setL2()

		const l2Account = await this.fetchAccount(this.l2Client, pk)

		const accountCreationFee = (helperAccount ? UInt64.zero : this.l2AccountCreationFee).add(
			l2Account ? UInt64.zero : this.l2AccountCreationFee
		)

		await refreshCache(this.sequencerPk)

		const txn = await Mina.transaction(
			{
				sender: this.sequencerPk,
				fee
			},
			async () => {
				const transferrer = AccountUpdate.create(depositParams.deposit.recipient)
				transferrer.balance.addInPlace(depositParams.deposit.amount.sub(accountCreationFee))
			}
		)

		txn.transaction.accountUpdates.push(...depositForest)

		return txn
	}

	public async canFinalizeDeposit(pk: PublicKey): Promise<boolean> {
		return !!(await this.fetchDepositFinalizationWitnesses(pk))
	}

	public async submitWithdrawal(
		feePayer: Mina.FeePayerSpec,
		{
			recipient,
			amount
		}: {
			recipient: PublicKey
			amount: UInt64
		}
	): Promise<Mina.Transaction<false, false>> {
		this.setL2()

		await refreshCache(feePayer)

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount)
			transferrer.body.actions = pushAction(transferrer.body.actions, [
				...recipient.toFields(),
				...amount.toFields()
			])
		})

		const { data } = await this.l2Client.mutation(submitWithdrawalMutation, {
			input: {
				recipient: recipient.toBase58(),
				amount: amount.toString(),
				children: "[]"
			}
		})
		if (!data?.request?.key) throw new Error("No key returned from mutation")

		const withdrawalForest = await this.pollQuery(data.request.key)

		txn.transaction.accountUpdates.push(...withdrawalForest)

		return txn
	}

	private async fetchWithdrawalFinalizationWitnesses(pk: PublicKey, outerHolder: PublicKey) {
		const helperAccount = await this.fetchAccount(
			this.l1Client,
			pk,
			TokenId.derive(this.outerTokenOwner)
		)

		const prevNextWithdrawal = helperAccount ? getNextWithdrawalIndex(helperAccount) : UInt32.zero

		const innerActions = await this.fetchInnerActions()

		const withdrawals = (await this.fetchUserWithdrawals(pk)).map((withdrawal) => ({
			withdrawal,
			aux: withdrawalAux(withdrawal)
		}))

		const findMatchingWithdrawal = (action: InnerWitness) =>
			withdrawals.find(({ aux }) => aux.equals(action.aux).toBoolean())

		const myWithdrawalIndex = innerActions.findIndex((action, index) => {
			const matchingWithdrawal = findMatchingWithdrawal(action)

			if (!matchingWithdrawal) return false

			if (prevNextWithdrawal.greaterThan(UInt32.from(index)).toBoolean()) return false

			return true
		})

		if (myWithdrawalIndex === -1) return null

		const myWithdrawal = innerActions[myWithdrawalIndex]
		const withdrawalParams = findMatchingWithdrawal(myWithdrawal)
		if (!withdrawalParams) throw new Error("Unreachable: Did not find withdrawal parameters")

		const currentSlot = await this.fetchCurrentSlot()

		const { commit: lastCommit, ase } = await fetchCommitAsePastWithdrawalDelay(
			this.actionsApiClient,
			+this.withdrawalDelay.add(currentSlot)
		)

		const lastCommitAse = ase.map(({ action }) => fromList([action]).hash)

		const syncedInnerActionStateIndex = innerActions.findIndex(({ action }) =>
			action.afterActionState.equals(lastCommit.innerActionState).toBoolean()
		)

		if (syncedInnerActionStateIndex === -1 || syncedInnerActionStateIndex < myWithdrawalIndex)
			return null

		const withdrawalAse = innerActions
			.slice(myWithdrawalIndex + 1, syncedInnerActionStateIndex + 1)
			.map(({ action }) => fromList([action.action]).hash)

		return {
			withdrawalParams,
			helperAccount,
			witness: {
				withdrawalParams: {
					amount: withdrawalParams.withdrawal.amount.toString(),
					recipient: withdrawalParams.withdrawal.recipient.toBase58(),
					children: "[]"
				},
				prevNextWithdrawal: prevNextWithdrawal.toString(),
				withdrawalAse: {
					fields: withdrawalAse.map((elem) => elem.toString()),
					stmt: {
						length: lastCommit.innerActionStateLength.sub(withdrawalAse.length).toString(),
						actionState: myWithdrawal.action.afterActionState.toString()
					}
				},
				beforeWithdrawal: {
					actionState: myWithdrawal.action.beforeActionState.toString()
				},
				commitAse: {
					fields: lastCommitAse.map((elem) => elem.toString()),
					stmt: { actionState: lastCommit.afterActionState.toString() }
				},
				commit: {
					actions: lastCommit.action.map((a) => a.toString())
				},
				beforeCommit: { actionState: lastCommit.beforeActionState.toString() },
				publicKey: outerHolder.toBase58()
			}
		}
	}

	public async finalizeWithdrawal(
		pk: PublicKey,
		feePayer: Mina.FeePayerSpec,
		_outerHolder?: PublicKey
	): Promise<Mina.Transaction<false, false>> {
		const outerHolder = _outerHolder ?? this.outerHolders[0]
		const witnesses = await this.fetchWithdrawalFinalizationWitnesses(pk, outerHolder)

		if (!witnesses) throw new Error("Did not find any withdrawal to finalize")

		const { witness, withdrawalParams, helperAccount } = witnesses

		const { data } = await this.l2Client.mutation(finalizeWithdrawalMutation, {
			input: witness
		})
		if (!data?.request?.key) throw new Error("No key returned from mutation")
		const withdrawalForest = await this.pollQuery(data.request.key)

		for (let i = 0; i < withdrawalForest.length; i++) {
			if (!withdrawalForest[i].publicKey.equals(pk).toBoolean()) continue

			withdrawalForest[i].lazyAuthorization = { kind: "lazy-signature" }
		}

		this.setL1()

		const accountCreationFee = helperAccount ? UInt64.zero : this.l1AccountCreationFee

		await refreshCache(feePayer)

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.create(withdrawalParams.withdrawal.recipient)
			transferrer.balance.addInPlace(withdrawalParams.withdrawal.amount.sub(accountCreationFee))
		})

		txn.transaction.accountUpdates.push(...withdrawalForest)

		return txn
	}

	public async canFinalizeWithdrawal(pk: PublicKey): Promise<boolean> {
		return !!(await this.fetchWithdrawalFinalizationWitnesses(pk, this.outerTokenOwner))
	}

	public async fetchDepositsWithStates(pk: PublicKey): Promise<{
		deposits: DepositWithState[]
		syncedIndex: number
		acceptedIndex: number
		confirmedIndex: number
		finalisedIndex: number
	}> {
		const deposits = await this.fetchUserDeposits(pk)

		const auxes = deposits.map(depositAux)

		const auxesMap = new Map<bigint, Deposit>()

		for (const deposit of deposits) {
			auxesMap.set(depositAux(deposit).toBigInt(), deposit)
		}

		const depositWitnesses = await fetchWitnessesFromAuxes(
			this.actionsApiClient,
			auxes.map((x) => x.toString())
		)

		const helperAccount = await this.fetchAccount(
			this.l2Client,
			pk,
			TokenId.derive(this.innerHolder)
		)
		const nextDeposit = helperAccount ? getNextDepositIndex(helperAccount) : UInt32.zero

		const syncedOuterActionState = await this.fetchSyncedOuterActionState()

		const currentSlot = await this.fetchCurrentSlot()

		const { commit: lastCommit } = await fetchCommitAsePastWithdrawalDelay(
			this.actionsApiClient,
			+currentSlot.sub(this.withdrawalDelay)
		)

		return {
			deposits: depositWitnesses.map((witness) => {
				const deposit = auxesMap.get(witness.aux.toBigInt())
				if (!deposit) throw new Error("Unreachable: Did not find deposit")
				return {
					...witness,
					...deposit,
					synced: syncedOuterActionState.length
						.greaterThanOrEqual(UInt32.from(witness.index + 1))
						.toBoolean(),
					accepted: lastCommit.index >= witness.index,
					confirmed: lastCommit.synchronizedOuterActionStateLength
						.greaterThanOrEqual(UInt32.from(witness.index + 1))
						.toBoolean(),
					finalised: nextDeposit.greaterThanOrEqual(UInt32.from(witness.index + 1)).toBoolean()
				}
			}),
			syncedIndex: 0,
			acceptedIndex: lastCommit.index,
			confirmedIndex: 0,
			finalisedIndex: 0
			//TODO: Find out why this is not working (Error: rangeCheck32: expected field to fit in 32 bits, got 28948022309329048855892746252171976963363056481941560715954676764349967630336)
			// syncedIndex: +syncedOuterActionState.length.sub(1).toString(),
			// acceptedIndex: lastCommit.index,
			// confirmedIndex: +lastCommit.synchronizedOuterActionStateLength.sub(1).toString(),
			// finalisedIndex: +nextDeposit.sub(1).toString()
		}
	}
	public async fetchInnerActionsWithStates(_pk: PublicKey): Promise<InnerActionWithState[]> {
		return []
		// const withdrawals = await this.fetchUserWithdrawals(pk)
		// const auxesMap = new Map<bigint, Withdrawal>()
		// for (const withdrawal of withdrawals) {
		// 	const aux = withdrawalAux(withdrawal)
		// 	auxesMap.set(aux.toBigInt(), withdrawal)
		// }

		// const helperAccount = await this.fetchAccount(
		// 	this.l1Client,
		// 	pk,
		// 	TokenId.derive(this.outerTokenOwner)
		// )
		// const nextWithdrawal = helperAccount ? getNextWithdrawalIndex(helperAccount) : UInt32.zero

		// const innerActions: MaybeWithdrawal[] = (await this.fetchInnerActions()).map(
		// 	(action, index) => {
		// 		const withdrawal = auxesMap.get(action.aux.toBigInt())
		// 		return {
		// 			...action,
		// 			withdrawal: withdrawal
		// 				? {
		// 						...withdrawal,
		// 						finalised: nextWithdrawal.greaterThan(UInt32.from(index)).toBoolean()
		// 					}
		// 				: undefined
		// 		}
		// 	}
		// )

		// const outerActions = await this.fetchOuterActions()
		// const reversedOuterActions = outerActions.slice().reverse()

		// const reversedLastCommitIndex = reversedOuterActions.findIndex(
		// 	(action) => action.type === "commit"
		// )
		// const lastCommitIndex =
		// 	reversedLastCommitIndex === -1 ? -1 : outerActions.length - reversedLastCommitIndex - 1

		// if (lastCommitIndex === -1)
		// 	return innerActions.map((action) => ({
		// 		...action,
		// 		committed: false,
		// 		isPastWithdrawalDelay: false
		// 	}))

		// const lastCommit = outerActions[lastCommitIndex] as OuterCommit

		// if (lastCommit.innerActionStateLength.equals(UInt32.zero).toBoolean()) {
		// 	return innerActions.map((action) => ({
		// 		...action,
		// 		committed: false,
		// 		isPastWithdrawalDelay: false
		// 	}))
		// }

		// const lastCommittedInnerIndex = lastCommit.innerActionStateLength.sub(1)

		// const innerActionsMaybeCommitted: (MaybeWithdrawal & {
		// 	committed: boolean
		// })[] = innerActions.map((action, index) => {
		// 	if (lastCommittedInnerIndex.greaterThanOrEqual(UInt32.from(index)).toBoolean())
		// 		return { ...action, committed: true }
		// 	return { ...action, committed: false }
		// })

		// const reversedLastPastDelayCommit = reversedOuterActions.findIndex(
		// 	(action) => action.type === "commit" && action.isPastWithdrawalDelay
		// )
		// const lastPastDelayCommitIndex =
		// 	reversedLastPastDelayCommit === -1
		// 		? -1
		// 		: outerActions.length - reversedLastPastDelayCommit - 1

		// if (lastPastDelayCommitIndex === -1)
		// 	return innerActionsMaybeCommitted.map((action) => ({
		// 		...action,
		// 		isPastWithdrawalDelay: false
		// 	}))

		// const lastPastDelayCommit = outerActions[lastPastDelayCommitIndex] as OuterCommit

		// if (lastPastDelayCommit.innerActionStateLength.equals(UInt32.zero).toBoolean()) {
		// 	return innerActionsMaybeCommitted.map((action) => ({
		// 		...action,
		// 		isPastWithdrawalDelay: false
		// 	}))
		// }

		// const lastPastDelayIndex = lastPastDelayCommit.innerActionStateLength.sub(1)

		// const innerActionsMaybePastDelay: (MaybeWithdrawal & {
		// 	committed: boolean
		// 	isPastWithdrawalDelay: boolean
		// })[] = innerActionsMaybeCommitted.map((action, index) => {
		// 	if (lastPastDelayIndex.greaterThanOrEqual(UInt32.from(index)).toBoolean())
		// 		return { ...action, isPastWithdrawalDelay: true }
		// 	return { ...action, isPastWithdrawalDelay: false }
		// })

		// return innerActionsMaybePastDelay
	}
}
