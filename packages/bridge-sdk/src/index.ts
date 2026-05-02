import {
	accountQuery,
	type cancelDepositMutation,
	fetchConfigQuery,
	finalizeDepositMutation,
	genesisConstantsQueryL1,
	genesisConstantsQueryL2,
	provedResultQuery,
	runtimeConfigQuery,
	sequencerPkQuery,
	submitDepositMutation,
	submitWithdrawalMutation
} from "@zeko-labs/graphql"
import {
	AccountUpdate,
	AccountUpdateForest,
	Bool,
	Field,
	Mina,
	PublicKey,
	TokenId,
	UInt32,
	UInt64,
	type Transaction
} from "o1js"
import * as v from "valibot"
import { fromList, pushAction } from "./actions"
import { ensureFirstWithdrawalAmountCanCreateHelper } from "./errors"
import { createGraphqlClient, type GqlClient } from "./graphql"
import type {
	Account,
	Action,
	Config,
	Deposit,
	DepositWithState,
	ExtractInput,
	OuterAction,
	OuterCommit,
	OuterWitness,
	Withdrawal,
	WithdrawalWithState,
	WitnessFetchResult
} from "./types"
import {
	BRIDGE_DEPLOY_BLOCK,
	checkAccepted,
	depositAux,
	fetchActions,
	fetchCommitAsePastSlot,
	fetchInnerWitnessesFromAuxes,
	fetchOuterActionsFromIndexer,
	fetchOuterWitnessesFromAuxes,
	fetchRecentActions,
	filterNulls,
	getNextCancelledDepositIndex,
	getNextDepositIndex,
	getNextWithdrawalIndex,
	refreshCache,
	safeDecrement,
	withdrawalAux
} from "./utils"

export * from "./actions"
export * from "./diagnostics"
export * from "./errors"
export * from "./graphql/index"
export * from "./types"

type DepositParams = {
	deposit: Deposit
	aux: Field
}

type DepositStateContext = {
	helperAccountL1: Account | null
	helperAccountL2: Account | null
	prevNextCancelledDeposit: UInt32
	prevNextDeposit: UInt32
	syncedOuterActionState: {
		state: Field
		length: UInt32
	}
	lastCommit: OuterCommit
	lastCommitAse: Field[]
	lastCommitIndex: number
	synchronizedOuterActionStateIndex: number
	currentSyncedOuterActionStateIndex: number
	depositWitnesses: OuterWitness[]
	depositsByAux: Map<bigint, DepositParams>
	outerActions: OuterAction[]
}

export class Bridge {
	private debug(message: string, details?: unknown): void {
		if (!this.config.verbose) return

		if (details === undefined) {
			console.debug(message)
			return
		}

		console.debug(message, details)
	}

	constructor(
		private readonly config: Config,

		private readonly l1Client: GqlClient,
		private readonly l1ArchiveClient: GqlClient,
		private readonly l2Client: GqlClient,
		private readonly l2ArchiveClient: GqlClient,
		private readonly actionsApiClient: GqlClient,

		public readonly l1AccountCreationFee: UInt64,
		public readonly l2AccountCreationFee: UInt64,

		public readonly outerPk: PublicKey,
		public readonly innerPk: PublicKey,
		public readonly outerHolders: PublicKey[],
		public readonly innerHolder: PublicKey,
		public readonly outerTokenOwner: PublicKey,
		public readonly sequencerPk: PublicKey,
		public readonly withdrawalDelay: UInt32,

		public readonly bridgeFeeRecipientL1: PublicKey,
		public readonly bridgeFeeRecipientL2: PublicKey,
		public readonly bridgeProofFee: UInt64
	) {}

	static async init(config: Config): Promise<Bridge> {
		const l1Client = createGraphqlClient(config.l1Url, "l1")
		const l1ArchiveClient = createGraphqlClient(config.l1ArchiveUrl, "l1-archive")
		const actionsApiClient = createGraphqlClient(config.actionsApi, "actions-api")
		const l2Client = createGraphqlClient(config.zekoUrl, "l2")
		const l2ArchiveClient = createGraphqlClient(config.zekoArchiveUrl, "l2-archive")

		const [fetchConfigResult, genesisConstantL2Result, genesisConstantL1Result, sequencerPkResult] =
			await Promise.all([
				l2Client().query(fetchConfigQuery, {}),
				l2Client().query(genesisConstantsQueryL2, {}),
				l1Client().query(genesisConstantsQueryL1, {}),
				l2Client().query(sequencerPkQuery, {})
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
			UInt32.from(circuitsConfig.withdrawalDelay),
			PublicKey.fromBase58(circuitsConfig.bridgeFeeRecipientL1),
			PublicKey.fromBase58(circuitsConfig.bridgeFeeRecipientL2),
			UInt64.from(circuitsConfig.bridgeProofFee)
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
		const { data } = await this.l1Client().query(runtimeConfigQuery, {})

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
		client: GqlClient,
		pk: PublicKey,
		tokenId?: Field
	): Promise<{ zkappState: string[] | null } | null> {
		const { data } = await client().query(accountQuery, {
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

	private async fetchUserWithdrawalActions(pk: PublicKey): Promise<Array<Action & Withdrawal>> {
		const archiveActions = await fetchActions(this.l2ArchiveClient, pk)
		const lastActionState = archiveActions.at(-1)?.afterActionState.toString()
		const liveActions = await fetchRecentActions(this.l2Client, pk, lastActionState)
		const userInnerActions = [...archiveActions, ...liveActions]

		this.debug("fetchUserWithdrawals action sources", {
			archiveCount: archiveActions.length,
			liveCount: liveActions.length,
			totalCount: userInnerActions.length
		})

		return filterNulls(
			userInnerActions.map((item) => {
				const [recipient1, recipient2, amount1] = item.action

				if (!recipient1 || !recipient2 || !amount1) return null

				return {
					...item,
					recipient: PublicKey.fromFields([recipient1, recipient2]),
					amount: UInt64.fromFields([amount1])
				}
			})
		)
	}

	private async pollQuery(key: string, pollPeriod = 5_000): Promise<string> {
		console.log("pollQuery", key)

		let result: string | null = null
		let attempts = 0

		while (!result) {
			if (
				typeof this.config.pollTimeout === "number" &&
				this.config.pollTimeout >= 0 &&
				attempts > this.config.pollTimeout / pollPeriod
			) {
				throw new Error("Failed to fetch proved forest")
			}

			await new Promise((resolve) => setTimeout(resolve, pollPeriod))
			attempts++
			this.debug("pollQuery waiting", { key, attempts, pollPeriod })

			const resultResponse = await this.l2Client().query(provedResultQuery, { key })
			if (resultResponse.error) throw resultResponse.error
			result = resultResponse.data?.provingResult ?? null

			if (!result) continue

			const resultObject: { proved?: unknown; executed?: string } = JSON.parse(result)

			if (resultObject.proved) {
				result = null
			} else if (resultObject.executed) {
				return resultObject.executed
			}
			throw new Error("Should not be reachable")
		}
		throw new Error("Should not be reachable")
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
		},
		signsTxn: (txn: Transaction<any, false>) => Promise<Transaction<any, true>>
	): Promise<string> {
		this.setL1()

		await refreshCache(recipient)
		await refreshCache(feePayer)
		await refreshCache(this.outerPk)

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount.add(this.bridgeProofFee))
			transferrer.body.actions = pushAction(transferrer.body.actions, [
				...recipient.toFields(),
				...amount.toFields(),
				...timeout.toFields(),
				...holderAccountL1.toFields(),
				...this.outerPk.toFields()
			])
			transferrer.body.incrementNonce = Bool(true)
			transferrer.account.nonce.getAndRequireEquals()
			transferrer.body.useFullCommitment = Bool(false)

			const receiver = AccountUpdate.create(holderAccountL1)
			receiver.balance.addInPlace(amount)
			receiver.body.useFullCommitment = Bool(true)
			receiver.body.implicitAccountCreationFee = Bool(true)
			receiver.body.mayUseToken = {
				parentsOwnToken: Bool(true),
				inheritFromParent: Bool(false)
			}

			const feePayout = AccountUpdate.create(this.bridgeFeeRecipientL1)
			feePayout.balance.addInPlace(this.bridgeProofFee)
			feePayout.body.useFullCommitment = Bool(true)
			feePayout.body.implicitAccountCreationFee = Bool(true)
			feePayout.body.mayUseToken = {
				parentsOwnToken: Bool(true),
				inheritFromParent: Bool(false)
			}

			const childrenHash = AccountUpdateForest.fromFlatArray([receiver, feePayout]).hash

			const actionWitness = AccountUpdate.create(this.outerPk)
			actionWitness.approve(receiver)
			actionWitness.approve(feePayout)
			actionWitness.body.actions = pushAction(actionWitness.body.actions, [
				Field(1), // tag
				depositAux({
					recipient,
					amount,
					timeout,
					holderAccountL1
				}), // aux
				childrenHash, // children hash
				Field(0), // lower validWhile
				...UInt32.from(4294967295).toFields() // upper validWhile
			])
			actionWitness.body.useFullCommitment = Bool(true)
			actionWitness.body.implicitAccountCreationFee = Bool(true)
			actionWitness.body.mayUseToken = {
				parentsOwnToken: Bool(false),
				inheritFromParent: Bool(false)
			}
			actionWitness.body.preconditions.account.state[1] = { isSome: Bool(true), value: Field(0) }
			actionWitness.body.preconditions.validWhile = {
				isSome: Bool(true),
				value: { lower: UInt32.from(0), upper: UInt32.from(4294967295) }
			}
			actionWitness.body.authorizationKind = {
				isSigned: Bool(false),
				isProved: Bool(true),
				verificationKeyHash: Mina.getAccount(this.outerPk).zkapp?.verificationKey?.hash!
			}

			AccountUpdate.attachToTransaction(actionWitness)
		})

		console.log(txn.toPretty())

		const signed = await signsTxn(txn)

		const transferrer = signed.transaction.accountUpdates.find(({ publicKey }) =>
			publicKey.equals(recipient).toBoolean()
		)
		if (!transferrer) throw new Error("Transferrer not found")

		const { data } = await this.l2Client().mutation(submitDepositMutation, {
			depositParams: {
				recipient: recipient.toBase58(),
				amount: amount.toString(),
				timeout: +timeout.toString(),
				holderAccountL1: holderAccountL1.toBase58(),
				children: "[]"
			},
			transferrer: JSON.stringify([AccountUpdate.toJSON(transferrer)])
		})
		if (!data?.request?.key) throw new Error("No key returned from mutation")

		return await this.pollQuery(data.request.key)
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

	private async fetchDepositFinalizationWitnesses(pk: PublicKey): Promise<
		WitnessFetchResult<{
			aseTarget: {
				state: Field
				length: UInt32
			}
			depositParams: {
				deposit: Deposit
				aux: Field
			}
			helperAccount: Account | null
			witness: ExtractInput<typeof finalizeDepositMutation>
		}>
	> {
		const context = await this.fetchDepositStateContext(pk)

		if (context.depositsByAux.size === 0) {
			return { ok: false, msg: "No deposits found" }
		}

		if (context.depositWitnesses.length === 0) {
			return { ok: false, msg: "No deposit witnesses found" }
		}

		const minDepositIndex = this.getMinResolvedDepositIndex(context)

		for (const witness of this.getSortedDepositWitnesses(context)) {
			if (
				this.isDepositCancelled(context, witness) ||
				this.isDepositFinalised(context, witness) ||
				minDepositIndex.greaterThan(UInt32.from(witness.index)).toBoolean()
			) {
				continue
			}

			if (this.buildDepositCancellationWitnessInput(context, witness) !== null) {
				continue
			}

			const finalizationWitness = this.buildDepositFinalizationWitnessValue(context, witness)
			if (finalizationWitness) {
				return {
					ok: true,
					value: finalizationWitness
				}
			}

			return { ok: false, msg: "Earlier deposit must be resolved first" }
		}

		return { ok: false, msg: "No finalizable deposit found" }
	}

	public async finalizeDeposit(
		pk: PublicKey,
		fee: UInt64 = UInt64.zero,
		attempts = 5
	): Promise<Mina.Transaction<false, false>> {
		const prove = async (attempts: number) => {
			if (attempts === 0) throw new Error("Failed to prove deposit finalization")

			const witnesses = await this.fetchDepositFinalizationWitnesses(pk)

			if (!witnesses.ok) throw new Error("Did not find any deposit to finalize")

			const { witness, depositParams, helperAccount, aseTarget } = witnesses.value

			await refreshCache(depositParams.deposit.recipient)
			await refreshCache(depositParams.deposit.recipient, TokenId.derive(this.innerHolder))

			let _isHelperAccountNew
			const _txn = await Mina.transaction(
				{
					sender: this.sequencerPk,
					fee
				},
				async () => {
					const helperAccount = AccountUpdate.createSigned(
						depositParams.deposit.recipient,
						TokenId.derive(this.innerHolder)
					)
					helperAccount.body.useFullCommitment = Bool(false)
					helperAccount.body.incrementNonce = Bool(true)
					helperAccount.body.implicitAccountCreationFee = Bool(false)
					helperAccount.body.mayUseToken = {
						parentsOwnToken: Bool(true),
						inheritFromParent: Bool(false)
					}
					helperAccount.body.update.appState[0] = {
						isSome: Bool(true),
						value: Field(+witness.checkAccepted.init.depositIndex + 1)
					}
					helperAccount.account.isNew.getAndRequireEquals()
					_isHelperAccountNew = helperAccount.body.preconditions.account.isNew.value.toBoolean()
					helperAccount.body.preconditions.account.state[0] = {
						isSome: Bool(true),
						value: Field(witness.prevNextDeposit)
					}
					helperAccount.account.nonce.getAndRequireEquals()
				}

				// witness inner

				// recipient payout

				// fee payout

				// finalize deposit
			)

			const { data } = await this.l2Client().mutation(finalizeDepositMutation, {
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

	public async canFinalizeDeposit(
		pk: PublicKey
	): Promise<{ available: boolean; reason: string | null }> {
		this.debug("canFinalizeDeposit start", { pk: pk.toBase58() })
		const result = await this.fetchDepositFinalizationWitnesses(pk)
		this.debug("canFinalizeDeposit result", result)
		return {
			available: result.ok,
			reason: result.ok ? null : result.msg
		}
	}

	private async fetchDepositStateContext(pk: PublicKey): Promise<DepositStateContext> {
		const deposits = (await this.fetchUserDeposits(pk)).map((deposit) => ({
			deposit,
			aux: depositAux(deposit)
		}))

		const depositsByAux = new Map<bigint, DepositParams>()

		for (const deposit of deposits) {
			depositsByAux.set(deposit.aux.toBigInt(), deposit)
		}

		const depositWitnesses =
			deposits.length === 0
				? []
				: await fetchOuterWitnessesFromAuxes(
						this.actionsApiClient,
						deposits.map(({ aux }) => aux.toString())
					)

		const [helperAccountL1, helperAccountL2, syncedOuterActionState, currentSlot] =
			await Promise.all([
				this.fetchAccount(this.l1Client, pk, TokenId.derive(this.outerTokenOwner)),
				this.fetchAccount(this.l2Client, pk, TokenId.derive(this.innerHolder)),
				this.fetchSyncedOuterActionState(),
				this.fetchCurrentSlot()
			])

		const prevNextCancelledDeposit = helperAccountL1
			? getNextCancelledDepositIndex(helperAccountL1)
			: UInt32.zero
		const prevNextDeposit = helperAccountL2 ? getNextDepositIndex(helperAccountL2) : UInt32.zero

		const { commit: lastCommit, ase } = await fetchCommitAsePastSlot(
			this.actionsApiClient,
			+currentSlot.sub(this.withdrawalDelay)
		)

		const earliestBeforeState =
			depositWitnesses.length === 0
				? null
				: [...depositWitnesses].sort((a, b) => a.index - b.index).at(0)?.beforeActionState ?? null

		const outerActions =
			earliestBeforeState === null
				? []
				: await fetchOuterActionsFromIndexer(this.actionsApiClient, {
						fromState: earliestBeforeState.toString()
					})

		return {
			helperAccountL1,
			helperAccountL2,
			prevNextCancelledDeposit,
			prevNextDeposit,
			syncedOuterActionState,
			lastCommit,
			lastCommitAse: ase.map(({ action }) => fromList([action]).hash),
			lastCommitIndex: outerActions.findIndex(({ index }) => lastCommit.index === index),
			synchronizedOuterActionStateIndex: outerActions.findIndex(({ index }) =>
				lastCommit.synchronizedOuterActionStateLength.equals(UInt32.from(index + 1)).toBoolean()
			),
			currentSyncedOuterActionStateIndex: outerActions.findIndex(({ afterActionState }) =>
				afterActionState.equals(syncedOuterActionState.state).toBoolean()
			),
			depositWitnesses,
			depositsByAux,
			outerActions
		}
	}

	private getSortedDepositWitnesses(context: DepositStateContext): OuterWitness[] {
		return [...context.depositWitnesses].sort((left, right) => left.index - right.index)
	}

	private getDepositParamsForWitness(
		context: DepositStateContext,
		witness: OuterWitness
	): DepositParams {
		const depositParams = context.depositsByAux.get(witness.aux.toBigInt())
		if (!depositParams) throw new Error("Unreachable: Did not find deposit")
		return depositParams
	}

	private isDepositCancelled(context: DepositStateContext, witness: OuterWitness): boolean {
		return context.prevNextCancelledDeposit.greaterThan(UInt32.from(witness.index)).toBoolean()
	}

	private isDepositFinalised(context: DepositStateContext, witness: OuterWitness): boolean {
		return context.prevNextDeposit.greaterThanOrEqual(UInt32.from(witness.index + 1)).toBoolean()
	}

	private getMinResolvedDepositIndex(context: DepositStateContext): UInt32 {
		return context.prevNextDeposit.greaterThan(context.prevNextCancelledDeposit).toBoolean()
			? context.prevNextDeposit
			: context.prevNextCancelledDeposit
	}

	private buildDepositFinalizationWitnessValue(
		context: DepositStateContext,
		witness: OuterWitness
	): {
		aseTarget: {
			state: Field
			length: UInt32
		}
		depositParams: {
			deposit: Deposit
			aux: Field
		}
		helperAccount: Account | null
		witness: ExtractInput<typeof finalizeDepositMutation>
	} | null {
		const depositParams = this.getDepositParamsForWitness(context, witness)
		const minDepositIndex = this.getMinResolvedDepositIndex(context)

		if (this.isDepositCancelled(context, witness) || this.isDepositFinalised(context, witness)) {
			return null
		}

		if (minDepositIndex.greaterThan(UInt32.from(witness.index)).toBoolean()) {
			return null
		}

		const depositActionIndex = context.outerActions.findIndex(
			(action) =>
				action.type === "witness" &&
				action.index === witness.index &&
				action.aux.equals(witness.aux).toBoolean()
		)

		if (depositActionIndex === -1) {
			return null
		}

		const { isRejected, isAccepted } = checkAccepted(
			context.outerActions,
			UInt32.from(witness.index),
			depositParams.deposit
		)

		if (isRejected || !isAccepted) {
			return null
		}

		const nextCommitIndex = context.outerActions.findIndex(
			(action, index) =>
				index > depositActionIndex &&
				action.type === "commit" &&
				action.synchronizedOuterActionStateLength
					.greaterThan(UInt32.from(witness.index))
					.toBoolean()
		)

		if (nextCommitIndex === -1) {
			return null
		}

		if (
			context.currentSyncedOuterActionStateIndex === -1 ||
			context.currentSyncedOuterActionStateIndex < nextCommitIndex
		) {
			return null
		}

		const nextCommit = context.outerActions[nextCommitIndex] as OuterCommit
		const aseElems = context.outerActions
			.slice(nextCommitIndex + 1, context.currentSyncedOuterActionStateIndex + 1)
			.map(({ action }) => fromList([action]).hash)

		return {
			aseTarget: context.syncedOuterActionState,
			depositParams,
			helperAccount: context.helperAccountL2,
			witness: {
				prevNextDeposit: context.prevNextDeposit.toString(),
				checkAccepted: {
					elems: context.outerActions
						.slice(depositActionIndex, nextCommitIndex + 1)
						.map(({ action }) => ({ actions: action.map((field) => field.toString()) })),
					init: {
						depositIndex: witness.index.toString(),
						orignalActionState: witness.beforeActionState.toString(),
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
						length: context.syncedOuterActionState.length.sub(aseElems.length).toString(),
						actionState: nextCommit.afterActionState.toString()
					},
					fields: aseElems.map((elem) => elem.toString())
				}
			}
		}
	}

	private buildDepositWithState(
		context: DepositStateContext,
		witness: OuterWitness
	): DepositWithState {
		const depositParams = this.getDepositParamsForWitness(context, witness)

		const cancelled = this.isDepositCancelled(context, witness)
		const synced = context.syncedOuterActionState.length
			.greaterThanOrEqual(UInt32.from(witness.index + 1))
			.toBoolean()
		const accepted = context.lastCommit.index >= witness.index
		const confirmed = context.lastCommit.synchronizedOuterActionStateLength
			.greaterThanOrEqual(UInt32.from(witness.index + 1))
			.toBoolean()
		const finalised = this.isDepositFinalised(context, witness)

		return {
			...witness,
			...depositParams.deposit,
			cancelled,
			synced,
			accepted,
			confirmed,
			finalised,
			cancellable: this.buildDepositCancellationWitnessInput(context, witness) !== null
		}
	}

	private buildDepositCancellationWitnessInput(
		context: DepositStateContext,
		witness: OuterWitness
	): Omit<ExtractInput<typeof cancelDepositMutation>, "publicKey"> | null {
		const depositParams = this.getDepositParamsForWitness(context, witness)

		const cancelled = this.isDepositCancelled(context, witness)
		const finalised = this.isDepositFinalised(context, witness)

		if (cancelled || finalised) return null

		const minDepositIndex = this.getMinResolvedDepositIndex(context)

		if (minDepositIndex.greaterThan(UInt32.from(witness.index)).toBoolean()) return null

		const cancellationActionIndex = context.outerActions.findIndex(
			(action) =>
				action.type === "witness" &&
				action.index === witness.index &&
				action.aux.equals(witness.aux).toBoolean()
		)

		if (cancellationActionIndex === -1) return null
		if (context.lastCommitIndex === -1 || context.lastCommitIndex < cancellationActionIndex)
			return null
		if (context.synchronizedOuterActionStateIndex === -1) return null

		const { isRejected, isAccepted } = checkAccepted(
			context.outerActions,
			UInt32.from(witness.index),
			depositParams.deposit
		)

		if (!isRejected || isAccepted) return null

		const syncAse = context.outerActions
			.slice(context.synchronizedOuterActionStateIndex + 1)
			.map(({ action }) => fromList([action]).hash)

		return {
			commitAse: {
				fields: context.lastCommitAse.map((elem) => elem.toString()),
				stmt: { actionState: context.lastCommit.afterActionState.toString() }
			},
			commit: {
				actions: context.lastCommit.action.map((action) => action.toString())
			},
			beforeCommit: { actionState: context.lastCommit.beforeActionState.toString() },
			prevNextCancelledDeposit: context.prevNextCancelledDeposit.toString(),
			checkAccepted: {
				elems: context.outerActions
					.slice(cancellationActionIndex, context.lastCommitIndex + 1)
					.map(({ action }) => ({ actions: action.map((field) => field.toString()) })),
				init: {
					depositIndex: witness.index.toString(),
					orignalActionState: witness.beforeActionState.toString(),
					params: {
						amount: depositParams.deposit.amount.toString(),
						recipient: depositParams.deposit.recipient.toBase58(),
						holderAccountL1: depositParams.deposit.holderAccountL1.toBase58(),
						timeout: +depositParams.deposit.timeout,
						children: "[]"
					}
				}
			},
			checkAcceptedAse: {
				fields: context.lastCommitAse.map((elem) => elem.toString()),
				stmt: {
					actionState: context.lastCommit.afterActionState.toString(),
					length: (context.lastCommit.index + 1).toString()
				}
			},
			syncAse: {
				fields: syncAse.map((elem) => elem.toString()),
				stmt: {
					actionState: context.lastCommit.synchronizedOuterActionState.toString(),
					length: context.lastCommit.synchronizedOuterActionStateLength.toString()
				}
			}
		}
	}

	// public async cancelDeposit(
	// 	pk: PublicKey,
	// 	feePayer: Mina.FeePayerSpec,
	// 	_outerHolder?: PublicKey
	// ): Promise<Mina.Transaction<false, false>> {
	// 	this.debug("cancelDeposit start", { pk: pk.toBase58() })
	// 	const outerHolder = _outerHolder ?? this.outerHolders[0]
	// 	const witnesses = await this.fetchDepositCancellationWitnesses(pk, outerHolder)
	// 	this.debug("cancelDeposit witnesses", witnesses)

	// 	if (!witnesses.ok) throw new Error("Did not find deposit to cancel")

	// 	const { witness, depositParams, helperAccount } = witnesses.value

	// 	const { data } = await this.l2Client().mutation(cancelDepositMutation, {
	// 		input: witness
	// 	})
	// 	if (!data?.request?.key) throw new Error("No key returned from mutation")
	// 	this.debug("cancelDeposit mutation key", { key: data.request.key })
	// 	const cancelDepositForest = await this.pollQuery(data.request.key)
	// 	this.debug("cancelDeposit forest ready", { updates: cancelDepositForest.length })

	// 	for (let i = 0; i < cancelDepositForest.length; i++) {
	// 		if (!cancelDepositForest[i].publicKey.equals(pk).toBoolean()) continue

	// 		cancelDepositForest[i].lazyAuthorization = { kind: "lazy-signature" }
	// 	}

	// 	this.setL1()

	// 	const accountCreationFee = helperAccount ? UInt64.zero : this.l1AccountCreationFee

	// 	await refreshCache(feePayer)

	// 	const txn = await Mina.transaction(feePayer, async () => {
	// 		const transferrer = AccountUpdate.create(depositParams.deposit.recipient)
	// 		transferrer.balance.addInPlace(depositParams.deposit.amount.sub(accountCreationFee))
	// 	})

	// 	txn.transaction.accountUpdates.push(...cancelDepositForest)

	// 	return txn
	// }

	// public async canCancelDeposit(
	// 	pk: PublicKey
	// ): Promise<{ available: boolean; reason: string | null }> {
	// 	const result = await this.fetchDepositsWithStates(pk)
	// 	const available = result.deposits.some((deposit) => deposit.cancellable)
	// 	this.debug("canCancelDeposit result", {
	// 		pk: pk.toBase58(),
	// 		available,
	// 		depositCount: result.deposits.length
	// 	})
	// 	return {
	// 		available,
	// 		reason: available ? null : "No cancellable deposit found"
	// 	}
	// }

	public async submitWithdrawal(
		feePayer: Mina.FeePayerSpec,
		{
			recipient,
			amount
		}: {
			recipient: PublicKey
			amount: UInt64
		},
		signsTxn: (txn: Transaction<any, false>) => Promise<Transaction<any, true>>
	): Promise<string> {
		this.setL2()

		await ensureFirstWithdrawalAmountCanCreateHelper({
			amount,
			recipient,
			accountCreationFee: this.l1AccountCreationFee,
			helperAccountExists: async () =>
				(await this.fetchAccount(
					this.l1Client,
					recipient,
					TokenId.derive(this.outerTokenOwner)
				)) !== null
		})

		await refreshCache(recipient)
		await refreshCache(feePayer)
		await refreshCache(this.innerHolder)
		await refreshCache(this.outerPk)

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount.add(this.bridgeProofFee))
			transferrer.body.actions = pushAction(transferrer.body.actions, [
				...recipient.toFields(),
				...amount.toFields()
			])
			transferrer.body.incrementNonce = Bool(true)
			transferrer.account.nonce.getAndRequireEquals()
			transferrer.body.useFullCommitment = Bool(false)

			const receiver = AccountUpdate.create(this.innerHolder)
			receiver.balance.addInPlace(amount)
			receiver.body.useFullCommitment = Bool(true)
			receiver.body.implicitAccountCreationFee = Bool(true)
			receiver.body.mayUseToken = {
				parentsOwnToken: Bool(true),
				inheritFromParent: Bool(false)
			}
			receiver.body.authorizationKind = {
				isSigned: Bool(false),
				isProved: Bool(true),
				verificationKeyHash: Mina.getAccount(this.innerHolder).zkapp?.verificationKey?.hash!
			}

			const feePayout = AccountUpdate.create(this.bridgeFeeRecipientL1)
			feePayout.balance.addInPlace(this.bridgeProofFee)
			feePayout.body.useFullCommitment = Bool(false)
			feePayout.body.implicitAccountCreationFee = Bool(true)
			feePayout.body.mayUseToken = {
				parentsOwnToken: Bool(false),
				inheritFromParent: Bool(false)
			}

			const actionWitness = AccountUpdate.create(this.outerPk)
			actionWitness.approve(receiver)
			actionWitness.approve(feePayout)
			actionWitness.body.actions = pushAction(actionWitness.body.actions, [
				Field(0), // tag
				withdrawalAux({
					recipient,
					amount
				}), // aux
				actionWitness.extractTree().children.hash // children hash
			])
			actionWitness.body.useFullCommitment = Bool(true)
			actionWitness.body.implicitAccountCreationFee = Bool(true)
			actionWitness.body.mayUseToken = {
				parentsOwnToken: Bool(false),
				inheritFromParent: Bool(false)
			}
			actionWitness.body.authorizationKind = {
				isSigned: Bool(false),
				isProved: Bool(true),
				verificationKeyHash: Mina.getAccount(this.innerPk).zkapp?.verificationKey?.hash!
			}
		})

		const signed = await signsTxn(txn)
		const transferrer = signed.transaction.accountUpdates.find(({ publicKey }) =>
			publicKey.equals(recipient).toBoolean()
		)
		if (!transferrer) throw new Error("Transferrer not found")

		const { data } = await this.l2Client().mutation(submitWithdrawalMutation, {
			withdrawalParams: {
				recipient: recipient.toBase58(),
				amount: amount.toString(),
				children: "[]"
			},
			transferrer: JSON.stringify([AccountUpdate.toJSON(transferrer)])
		})
		if (!data?.request?.key) throw new Error("No key returned from mutation")

		return await this.pollQuery(data.request.key)
	}

	// public async finalizeWithdrawal(
	// 	pk: PublicKey,
	// 	feePayer: Mina.FeePayerSpec,
	// 	_outerHolder?: PublicKey
	// ): Promise<Mina.Transaction<false, false>> {
	// 	const outerHolder = _outerHolder ?? this.outerHolders[0]
	// 	const witnesses = await this.fetchWithdrawalFinalizationWitnesses(pk, outerHolder)

	// 	if (!witnesses.ok) throw new Error("Did not find any withdrawal to finalize")

	// 	const { witness, withdrawalParams, helperAccount } = witnesses.value

	// 	const { data } = await this.l2Client().mutation(finalizeWithdrawalMutation, {
	// 		input: witness
	// 	})
	// 	if (!data?.request?.key) throw new Error("No key returned from mutation")
	// 	const withdrawalForest = await this.pollQuery(data.request.key)

	// 	for (let i = 0; i < withdrawalForest.length; i++) {
	// 		if (!withdrawalForest[i].publicKey.equals(pk).toBoolean()) continue

	// 		withdrawalForest[i].lazyAuthorization = { kind: "lazy-signature" }
	// 	}

	// 	this.setL1()

	// 	const accountCreationFee = helperAccount ? UInt64.zero : this.l1AccountCreationFee

	// 	await refreshCache(feePayer)

	// 	const txn = await Mina.transaction(feePayer, async () => {
	// 		const transferrer = AccountUpdate.create(withdrawalParams.withdrawal.recipient)
	// 		transferrer.balance.addInPlace(withdrawalParams.withdrawal.amount.sub(accountCreationFee))
	// 	})

	// 	txn.transaction.accountUpdates.push(...withdrawalForest)

	// 	return txn
	// }

	// public async canFinalizeWithdrawal(
	// 	pk: PublicKey
	// ): Promise<{ available: boolean; reason: string | null }> {
	// 	this.debug("canFinalizeWithdrawal start", { pk: pk.toBase58() })
	// 	const result = await this.fetchWithdrawalFinalizationWitnesses(pk, this.outerTokenOwner)
	// 	this.debug("canFinalizeWithdrawal result", result)
	// 	return {
	// 		available: result.ok,
	// 		reason: result.ok ? null : result.msg
	// 	}
	// }

	public async fetchDepositsWithStates(pk: PublicKey): Promise<{
		deposits: DepositWithState[]
		syncedIndex: number
		acceptedIndex: number
		confirmedIndex: number
		finalisedIndex: number
		cancelledIndex: number
	}> {
		const context = await this.fetchDepositStateContext(pk)

		return {
			deposits: this.getSortedDepositWitnesses(context).map((witness) =>
				this.buildDepositWithState(context, witness)
			),
			syncedIndex: +safeDecrement(context.syncedOuterActionState.length).toString(),
			acceptedIndex: context.lastCommit.index,
			confirmedIndex: +safeDecrement(
				context.lastCommit.synchronizedOuterActionStateLength
			).toString(),
			finalisedIndex: +safeDecrement(context.prevNextDeposit).toString(),
			cancelledIndex: +safeDecrement(context.prevNextCancelledDeposit).toString()
		}
	}

	public async fetchWithdrawalsWithStates(pk: PublicKey): Promise<{
		withdrawals: WithdrawalWithState[]
		committedIndex: number
		finalisedIndex: number
	}> {
		const withdrawals = await this.fetchUserWithdrawalActions(pk)

		const auxes = withdrawals.map(withdrawalAux)

		const auxesMap = new Map<bigint, Action & Withdrawal>()
		for (const withdrawal of withdrawals) {
			auxesMap.set(withdrawalAux(withdrawal).toBigInt(), withdrawal)
		}

		const withdrawalWitnesses = await fetchInnerWitnessesFromAuxes(
			this.actionsApiClient,
			auxes.map((x) => x.toString())
		)

		const helperAccount = await this.fetchAccount(
			this.l1Client,
			pk,
			TokenId.derive(this.outerTokenOwner)
		)
		const nextWithdrawal = helperAccount ? getNextWithdrawalIndex(helperAccount) : UInt32.zero

		const currentSlot = await this.fetchCurrentSlot()

		const { commit: lastCommit } = await fetchCommitAsePastSlot(
			this.actionsApiClient,
			+currentSlot.sub(this.withdrawalDelay)
		)

		const witnessedAuxes = new Set(
			withdrawalWitnesses.map((witness) => witness.aux.toBigInt().toString())
		)
		const provisionalWithdrawals = withdrawals
			.filter((withdrawal) => !witnessedAuxes.has(withdrawalAux(withdrawal).toBigInt().toString()))
			.map((withdrawal, index, pending) => ({
				...withdrawal,
				index: -(pending.length - index),
				committed: false,
				finalised: false
			}))

		return {
			withdrawals: [
				...provisionalWithdrawals,
				...withdrawalWitnesses.map((witness) => {
					const withdrawal = auxesMap.get(witness.aux.toBigInt())
					if (!withdrawal) throw new Error("Unreachable: Did not find withdrawal")
					return {
						...witness,
						...withdrawal,
						committed: lastCommit.innerActionStateLength
							.greaterThan(UInt32.from(witness.index))
							.toBoolean(),
						finalised: nextWithdrawal.greaterThanOrEqual(UInt32.from(witness.index + 1)).toBoolean()
					}
				})
			],
			committedIndex: +safeDecrement(lastCommit.innerActionStateLength).toString(),
			finalisedIndex: +safeDecrement(nextWithdrawal).toString()
		}
	}
}
