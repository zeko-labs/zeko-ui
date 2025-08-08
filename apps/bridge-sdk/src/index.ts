import { AccountUpdate, Field, Mina, PublicKey, TokenId, type Types, UInt32, UInt64 } from "o1js"
import type { Client } from "urql"
import * as v from "valibot"
import { fromList, pushAction } from "./actions"
import { createGraphqlClient } from "./graphql"
import { accountQuery, genesisConstantsQueryL1, runtimeConfigQuery } from "./graphql/queries/mina"
import {
	fetchConfigQuery,
	finalizeDepositMutation,
	finalizeWithdrawalMutation,
	genesisConstantsQueryL2,
	provedForestQuery,
	sequencerPkQuery,
	submitDepositMutation,
	submitWithdrawalMutation
} from "./graphql/queries/zeko"
import type {
	Account,
	Config,
	Deposits,
	InnerAction,
	InnerWitness,
	OuterAction,
	OuterCommit,
	OuterWitness,
	Withdrawals
} from "./types"
import { depositAux, fetchActions, withdrawalAux } from "./utils"

export class Bridge {
	constructor(
		private readonly config: Config,

		private readonly l1Client: Client,
		private readonly l1ArchiveClient: Client,
		private readonly l2Client: Client,

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
		const l2Client = createGraphqlClient(config.zekoUrl)

		const fetchConfigResult = await l2Client.query(fetchConfigQuery, {})
		const circuitsConfig = fetchConfigResult.data?.circuitsConfig
		if (!circuitsConfig) throw new Error("Circuits config not found")

		const genesisConstantL1Result = await l1Client.query(genesisConstantsQueryL1, {})
		const l1AccountCreationFee = genesisConstantL1Result.data?.genesisConstants?.accountCreationFee
		if (!l1AccountCreationFee) throw new Error("L1 account creation fee not found")

		const genesisConstantL2Result = await l2Client.query(genesisConstantsQueryL2, {})
		const l2AccountCreationFee = genesisConstantL2Result.data?.genesisConstants?.accountCreationFee
		if (!l2AccountCreationFee) throw new Error("L2 account creation fee not found")

		const sequencerPkResult = await l2Client.query(sequencerPkQuery, {})
		const sequencerPk = sequencerPkResult.data?.sequencerPk
		if (!sequencerPk) throw new Error("Sequencer public key not found")

		return new Bridge(
			config,
			l1Client,
			l1ArchiveClient,
			l2Client,
			UInt64.from(l1AccountCreationFee),
			UInt64.from(l2AccountCreationFee),
			PublicKey.fromBase58(circuitsConfig.zekoL1),
			PublicKey.fromBase58(circuitsConfig.zekoL2),
			circuitsConfig.holderAccountsL1.map((holder) => PublicKey.fromBase58(holder)),
			PublicKey.fromBase58(circuitsConfig.holderAccountL2),
			PublicKey.fromBase58(circuitsConfig.helperTokenOwnerL1),
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

	public async fetchAccount(
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

	public async fetchOuterActions(
		pk: PublicKey,
		actionStates?: Mina.ActionStates
	): Promise<OuterAction[]> {
		const actions = await fetchActions(this.l1ArchiveClient, pk, actionStates)
		const currentSlot = await this.fetchCurrentSlot()

		return actions.map(({ beforeActionState, afterActionState, action }) => {
			if (action[0].equals(0).toBoolean()) {
				return {
					type: "commit",
					ledger: action[1],
					innerActionState: action[2],
					innerActionStateLength: UInt32.fromFields([action[3]]),
					synchronizedOuterActionState: action[4],
					synchronizedOuterActionStateLength: UInt32.fromFields([action[5]]),
					slotRange: {
						lower: UInt32.fromFields([action[6]]),
						upper: UInt32.fromFields([action[7]])
					},
					isPastWithdrawalDelay: currentSlot
						.greaterThan(UInt32.fromFields([action[7]]).add(this.withdrawalDelay))
						.toBoolean(),
					action: { beforeActionState, afterActionState, action }
				}
			}
			if (action[0].equals(1).toBoolean()) {
				return {
					type: "witness",
					aux: action[1],
					action: { beforeActionState, afterActionState, action }
				}
			}
			throw new Error("Invalid outer action type")
		})
	}

	public async fetchInnerActions(
		pk: PublicKey,
		actionStates?: Mina.ActionStates
	): Promise<InnerAction[]> {
		const actions = await fetchActions(this.l2Client, pk, actionStates)

		return actions.map(({ beforeActionState, afterActionState, action }) => {
			if (action[0].equals(0).toBoolean()) {
				return {
					type: "witness",
					aux: action[1],
					action: { beforeActionState, afterActionState, action }
				}
			}
			throw new Error("Invalid inner action type")
		})
	}

	private async pollQuery(key: string, pollPeriod = 1_000) {
		let provedForest: string | null = null
		let attempts = 0

		while (!provedForest) {
			if (attempts > (this.config.pollTimeout ?? 30_000) / pollPeriod) {
				throw new Error("Failed to fetch proved forest")
			}

			await new Promise((resolve) => setTimeout(resolve, pollPeriod))
			attempts++

			const resultResponse = await this.l2Client.query(provedForestQuery, { key })
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
			holderAccountL1
		}: {
			recipient: PublicKey
			amount: UInt64
			timeout: UInt32
			holderAccountL1: PublicKey
		}
	): Promise<Mina.Transaction<false, false>> {
		this.setL1()

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

	public async findDeposits(pk: PublicKey): Promise<Deposits> {
		const userOuterActions = await fetchActions(this.l1ArchiveClient, pk)
		const currentSlot = await this.fetchCurrentSlot()

		return userOuterActions
			.map(({ beforeActionState, afterActionState, action }) => {
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
					beforeActionState,
					afterActionState,
					recipient,
					amount,
					timeout,
					holderAccountL1,
					outerPk,
					timedOut: timeout.lessThan(currentSlot).toBoolean()
				}
			})
			.filter(Boolean) as Deposits
	}

	public async getNextDepositIndex(helperAccount: Account): Promise<UInt32> {
		const nextDepositIndex = helperAccount.zkappState?.at(0)
		return UInt32.from(nextDepositIndex ?? 0)
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

	public async finalizeDeposit(
		pk: PublicKey,
		fee: UInt64 = UInt64.zero
	): Promise<Mina.Transaction<false, false>> {
		const helperAccount = await this.fetchAccount(
			this.l2Client,
			pk,
			TokenId.derive(this.innerHolder)
		)

		const prevNextDeposit = helperAccount
			? await this.getNextDepositIndex(helperAccount)
			: UInt32.zero

		const outerActions = await this.fetchOuterActions(this.outerPk)

		const deposits = (await this.findDeposits(pk)).map((deposit) => ({
			deposit,
			aux: depositAux(deposit)
		}))

		const findMatchingDeposit = (action: OuterWitness) =>
			deposits.find(
				({ aux, deposit: { timedOut } }) => aux.equals(action.aux).toBoolean() && !timedOut
			)

		const myDepositIndex = outerActions.findIndex((action, index) => {
			if (action.type === "commit") return false

			const matchingDeposit = findMatchingDeposit(action)

			if (!matchingDeposit) return false

			if (prevNextDeposit.greaterThan(UInt32.from(index)).toBoolean()) return false

			return true
		})

		if (myDepositIndex === -1) throw new Error("Did not find any deposit to finalize")

		const myDeposit = outerActions[myDepositIndex] as OuterWitness

		const nextCommitIndex = outerActions.findIndex((action, index) => {
			if (action.type !== "commit") return false

			if (myDepositIndex >= index) return false

			return true
		})

		if (nextCommitIndex === -1) throw new Error("Next commit not found")

		const nextCommit = outerActions[nextCommitIndex] as OuterCommit

		const depositParams = findMatchingDeposit(myDeposit)
		if (!depositParams) throw new Error("Did not find deposit parameters")

		const syncedOuterActionState = await this.fetchSyncedOuterActionState()

		const syncedOuterActionStateIndex = outerActions.findIndex(({ action }) =>
			action.afterActionState.equals(syncedOuterActionState.state).toBoolean()
		)

		if (syncedOuterActionStateIndex === -1 || syncedOuterActionStateIndex < nextCommitIndex)
			throw new Error("Next commit has not been synced")

		const aseElems = outerActions
			.slice(nextCommitIndex + 1, syncedOuterActionStateIndex + 1)
			.map(({ action }) => fromList([action.action]).hash)

		const { data } = await this.l2Client.mutation(finalizeDepositMutation, {
			input: {
				prevNextDeposit,
				checkAccepted: {
					elems: outerActions
						.slice(myDepositIndex, nextCommitIndex + 1)
						.map(({ action }) => ({ actions: action.action.map((a) => a.toString()) })),
					init: {
						depositIndex: myDepositIndex,
						orignalActionState: myDeposit.action.beforeActionState.toString(),
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
						length: syncedOuterActionState.length.sub(aseElems.length),
						actionState: nextCommit.action.afterActionState.toString()
					},
					fields: aseElems.map((elem) => elem.toString())
				}
			}
		})

		if (!data?.request?.key) throw new Error("No key returned from mutation")
		const depositForest = await this.pollQuery(data.request.key)

		for (let i = 0; i < depositForest.length; i++) {
			if (!depositForest[i].publicKey.equals(pk).toBoolean()) continue

			depositForest[i].lazyAuthorization = { kind: "lazy-signature" }
		}

		this.setL2()

		const accountCreationFee = helperAccount ? UInt64.zero : this.l2AccountCreationFee.mul(2)

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

	// New helper: check if a user can finalize a deposit right now
	public async canFinalizeDeposit(pk: PublicKey): Promise<boolean> {
		// Determine which deposit (if any) is next for this user
		const helperAccount = await this.fetchAccount(
			this.l2Client,
			pk,
			TokenId.derive(this.innerHolder)
		)

		const prevNextDeposit = helperAccount
			? await this.getNextDepositIndex(helperAccount)
			: UInt32.zero

		const outerActions = await this.fetchOuterActions(this.outerPk)

		const deposits = (await this.findDeposits(pk)).map((deposit) => ({
			deposit,
			aux: depositAux(deposit)
		}))

		const findMatchingDeposit = (action: OuterWitness) =>
			deposits.find(
				({ aux, deposit: { timedOut } }) => aux.equals(action.aux).toBoolean() && !timedOut
			)

		const myDepositIndex = outerActions.findIndex((action, index) => {
			if (action.type === "commit") return false

			const matchingDeposit = findMatchingDeposit(action)
			if (!matchingDeposit) return false

			if (prevNextDeposit.greaterThan(UInt32.from(index)).toBoolean()) return false

			return true
		})

		if (myDepositIndex === -1) return false

		// There must be a commit after our deposit
		const nextCommitIndex = outerActions.findIndex((action, index) => {
			if (action.type !== "commit") return false
			return index > myDepositIndex
		})
		if (nextCommitIndex === -1) return false

		// That commit must have been synced to the inner state
		const syncedOuterActionState = await this.fetchSyncedOuterActionState()
		const syncedOuterActionStateIndex = outerActions.findIndex(({ action }) =>
			action.afterActionState.equals(syncedOuterActionState.state).toBoolean()
		)

		return syncedOuterActionStateIndex !== -1 && syncedOuterActionStateIndex >= nextCommitIndex
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

	public async findWithdrawals(pk: PublicKey): Promise<Withdrawals> {
		const userInnerActions = await fetchActions(this.l2Client, pk)

		return userInnerActions
			.map(({ beforeActionState, afterActionState, action }) => {
				const [recipient1, recipient2, amount1] = action

				if (!recipient1 || !recipient2 || !amount1) return null

				const recipient = PublicKey.fromFields([recipient1, recipient2])
				const amount = UInt64.fromFields([amount1])

				return {
					beforeActionState,
					afterActionState,
					recipient,
					amount
				}
			})
			.filter(Boolean) as Withdrawals
	}

	public async getNextWithdrawalIndex(helperAccount: Account): Promise<UInt32> {
		const nextWithdrawalIndex = helperAccount.zkappState?.at(1)
		return UInt32.from(nextWithdrawalIndex ?? 0)
	}

	public async finalizeWithdrawal(
		pk: PublicKey,
		feePayer: Mina.FeePayerSpec,
		outerHolder: PublicKey
	): Promise<Mina.Transaction<false, false>> {
		const helperAccount = await this.fetchAccount(
			this.l1Client,
			pk,
			TokenId.derive(this.outerTokenOwner)
		)

		const prevNextWithdrawal = helperAccount
			? await this.getNextWithdrawalIndex(helperAccount)
			: UInt32.zero

		const innerActions = await this.fetchInnerActions(this.innerPk)

		const withdrawals = (await this.findWithdrawals(pk)).map((withdrawal) => ({
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

		if (myWithdrawalIndex === -1) throw new Error("Did not find any withdrawal to finalize")

		const myWithdrawal = innerActions[myWithdrawalIndex]
		const withdrawalParams = findMatchingWithdrawal(myWithdrawal)
		if (!withdrawalParams) throw new Error("Did not find withdrawal parameters")
		const outerActions = await this.fetchOuterActions(this.outerPk)

		const reversedOuterActions = outerActions.slice().reverse()
		const reversedLastCommitIndex = reversedOuterActions.findIndex((action) => {
			if (action.type !== "commit") return false

			if (!action.isPastWithdrawalDelay) return false

			return true
		})

		if (reversedLastCommitIndex === -1) throw new Error("Last commit not found")

		const lastCommitIndex = outerActions.length - reversedLastCommitIndex - 1
		const lastCommit = outerActions[lastCommitIndex] as OuterCommit

		const lastCommitAse = outerActions
			.slice(lastCommitIndex + 1, outerActions.length)
			.map(({ action }) => fromList([action.action]).hash)

		const syncedInnerActionStateIndex = innerActions.findIndex(({ action }) =>
			action.afterActionState.equals(lastCommit.innerActionState).toBoolean()
		)

		if (syncedInnerActionStateIndex === -1 || syncedInnerActionStateIndex < myWithdrawalIndex)
			throw new Error("Withdrawal has not been synced")

		const withdrawalAse = innerActions
			.slice(myWithdrawalIndex + 1, syncedInnerActionStateIndex + 1)
			.map(({ action }) => fromList([action.action]).hash)

		const { data } = await this.l2Client.mutation(finalizeWithdrawalMutation, {
			input: {
				withdrawalParams: {
					amount: withdrawalParams.withdrawal.amount.toString(),
					recipient: withdrawalParams.withdrawal.recipient.toBase58(),
					children: "[]"
				},
				prevNextWithdrawal,
				withdrawalAse: {
					fields: withdrawalAse.map((elem) => elem.toString()),
					stmt: {
						length: lastCommit.innerActionStateLength.sub(withdrawalAse.length),
						actionState: myWithdrawal.action.afterActionState.toString()
					}
				},
				beforeWithdrawal: {
					actionState: myWithdrawal.action.beforeActionState.toString()
				},
				commitAse: {
					fields: lastCommitAse.map((elem) => elem.toString()),
					stmt: { actionState: lastCommit.action.afterActionState.toString() }
				},
				commit: {
					actions: lastCommit.action.action.map((a) => a.toString())
				},
				beforeCommit: { actionState: lastCommit.action.beforeActionState.toString() },
				publicKey: outerHolder.toBase58()
			}
		})
		if (!data?.request?.key) throw new Error("No key returned from mutation")
		const withdrawalForest = await this.pollQuery(data.request.key)

		for (let i = 0; i < withdrawalForest.length; i++) {
			if (!withdrawalForest[i].publicKey.equals(pk).toBoolean()) continue

			withdrawalForest[i].lazyAuthorization = { kind: "lazy-signature" }
		}

		this.setL1()

		const accountCreationFee = helperAccount ? UInt64.zero : this.l1AccountCreationFee

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.create(withdrawalParams.withdrawal.recipient)
			transferrer.balance.addInPlace(withdrawalParams.withdrawal.amount.sub(accountCreationFee))
		})

		txn.transaction.accountUpdates.push(...withdrawalForest)

		return txn
	}

	// New helper: check if a user can finalize a withdrawal right now
	public async canFinalizeWithdrawal(pk: PublicKey): Promise<boolean> {
		const helperAccount = await this.fetchAccount(
			this.l1Client,
			pk,
			TokenId.derive(this.outerTokenOwner)
		)

		const prevNextWithdrawal = helperAccount
			? await this.getNextWithdrawalIndex(helperAccount)
			: UInt32.zero

		const innerActions = await this.fetchInnerActions(this.innerPk)

		const withdrawals = (await this.findWithdrawals(pk)).map((withdrawal) => ({
			withdrawal,
			aux: withdrawalAux(withdrawal)
		}))

		const myWithdrawalIndex = innerActions.findIndex((action, index) => {
			const matching = withdrawals.find(({ aux }) => aux.equals(action.aux).toBoolean())
			if (!matching) return false
			if (prevNextWithdrawal.greaterThan(UInt32.from(index)).toBoolean()) return false
			return true
		})

		if (myWithdrawalIndex === -1) return false

		const outerActions = await this.fetchOuterActions(this.outerPk)
		const reversedOuterActions = outerActions.slice().reverse()
		const reversedLastCommitIndex = reversedOuterActions.findIndex((action) => {
			if (action.type !== "commit") return false
			if (!action.isPastWithdrawalDelay) return false
			return true
		})
		if (reversedLastCommitIndex === -1) return false

		const lastCommitIndex = outerActions.length - reversedLastCommitIndex - 1
		const lastCommit = outerActions[lastCommitIndex] as OuterCommit

		const syncedInnerActionStateIndex = innerActions.findIndex(({ action }) =>
			action.afterActionState.equals(lastCommit.innerActionState).toBoolean()
		)

		return syncedInnerActionStateIndex !== -1 && syncedInnerActionStateIndex >= myWithdrawalIndex
	}
}
