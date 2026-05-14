import {
	accountQuery,
	cancelDepositMutation,
	fetchConfigQuery,
	finalizeDepositMutation,
	finalizeWithdrawalMutation,
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
	Provable,
	PublicKey,
	Signature,
	TokenId,
	UInt32,
	UInt64,
	type Transaction
} from "o1js"
import * as v from "valibot"
import { Actions, Events, fromList } from "./actions"
import {
	assertFirstWithdrawalAmountCanCreateHelper,
	ensureFirstWithdrawalAmountCanCreateHelper,
	InsufficientFirstWithdrawalAmountError
} from "./errors"
import { createGraphqlClient, type GqlClient } from "./graphql"
import type {
	Account,
	Action,
	Config,
	Deposit,
	DepositWithState,
	ExtractInput,
	InnerWitness,
	OuterAction,
	OuterCommit,
	OuterWitness,
	Withdrawal,
	WithdrawalFinalizationResult,
	WithdrawalWithState,
	WitnessFetchResult
} from "./types"
import {
	BRIDGE_DEPLOY_BLOCK,
	checkAccepted,
	depositAux,
	fetchActions,
	fetchCommitAsePastSlot,
	fetchInnerActionsFromIndexer,
	fetchInnerWitnessesFromAuxes,
	fetchOuterActionsFromIndexer,
	fetchOuterWitnessesFromAuxes,
	fetchRecentActions,
	filterNulls,
	getNextCancelledDepositIndex,
	getNextDepositIndex,
	getNextWithdrawalIndex,
	getVkHash,
	refreshCache,
	safeDecrement,
	uint32Max,
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
	lastCommit: OuterCommit | null
	lastCommitAse: Field[]
	lastCommitIndex: number
	commitAseTarget: Field
	synchronizedOuterActionStateIndex: number
	currentSyncedOuterActionStateIndex: number
	depositWitnesses: OuterWitness[]
	depositsByAux: Map<bigint, DepositParams>
	outerActions: OuterAction[]
}

type RetryableTransactionOptions = {
	attempts?: number
	feeNanomina?: number | bigint
}

const DEFAULT_BRIDGE_FEE_NANOMINA = 1 * 10e8
const NO_OUTER_COMMIT_REASON = "No outer commit available yet"

const normalizeRetryableTransactionOptions = (
	options: number | RetryableTransactionOptions | undefined
) => {
	if (typeof options === "number") {
		return {
			attempts: options,
			fee: UInt64.from(DEFAULT_BRIDGE_FEE_NANOMINA)
		}
	}

	return {
		attempts: options?.attempts ?? 5,
		fee: UInt64.from(options?.feeNanomina ?? DEFAULT_BRIDGE_FEE_NANOMINA)
	}
}

const isUnknownLiveActionCursorError = (error: unknown): boolean => {
	const message =
		error && typeof error === "object" && "message" in error ? String(error.message) : String(error)
	return /\bfrom\s+\d+\s+not found\b/i.test(message)
}

const mergeActionsByAfterState = <TAction extends Action>(actions: TAction[]): TAction[] => {
	const seen = new Set<string>()
	return actions.filter((action) => {
		const afterState = action.afterActionState.toString()
		if (seen.has(afterState)) return false
		seen.add(afterState)
		return true
	})
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
		public readonly bridgeProofFee: UInt64,

		private readonly V2_DEPOSITS_START_INDEX: UInt32 = UInt32.zero,
		private readonly V2_WITHDRAWALS_START_INDEX: UInt32 = UInt32.zero
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

		const V2_DEPOSITS_START_INDEX =
			config.l2Network === "testnet" ? UInt32.from(68520) : UInt32.from(0)
		const V2_WITHDRAWALS_START_INDEX =
			config.l2Network === "testnet" ? UInt32.from(10529) : UInt32.from(0)

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
			circuitsConfig.holderAccountsL1.map((holder: string) => PublicKey.fromBase58(holder)), // outerHolders
			PublicKey.fromBase58(circuitsConfig.holderAccountL2), // innerHolder
			PublicKey.fromBase58(circuitsConfig.helperTokenOwnerL1), // outerTokenOwner
			PublicKey.fromBase58(sequencerPk),
			UInt32.from(circuitsConfig.withdrawalDelay),
			PublicKey.fromBase58(circuitsConfig.bridgeFeeRecipientL1),
			PublicKey.fromBase58(circuitsConfig.bridgeFeeRecipientL2),
			UInt64.from(circuitsConfig.bridgeProofFee),
			V2_DEPOSITS_START_INDEX,
			V2_WITHDRAWALS_START_INDEX
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
		const liveActions = await this.fetchLiveWithdrawalActions(pk, lastActionState)
		const userInnerActions = mergeActionsByAfterState([...archiveActions, ...liveActions])

		this.debug("fetchUserWithdrawals action sources", {
			archiveEndpoint: this.config.zekoArchiveUrl,
			liveEndpoint: this.config.zekoUrl,
			archiveCount: archiveActions.length,
			liveCount: liveActions.length,
			totalCount: userInnerActions.length,
			lastArchivedActionState: lastActionState
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

	private async fetchLiveWithdrawalActions(
		pk: PublicKey,
		lastArchiveActionState?: string
	): Promise<Action[]> {
		if (!lastArchiveActionState) return await fetchRecentActions(this.l2Client, pk)

		try {
			return await fetchRecentActions(this.l2Client, pk, lastArchiveActionState)
		} catch (error) {
			if (!isUnknownLiveActionCursorError(error)) throw error

			this.debug("fetchUserWithdrawals live cursor not found; retrying without cursor", {
				lastArchiveActionState
			})
			return await fetchRecentActions(this.l2Client, pk)
		}
	}

	private async fetchUserWithdrawals(pk: PublicKey): Promise<Withdrawal[]> {
		return (await this.fetchUserWithdrawalActions(pk)).map(({ recipient, amount }) => ({
			recipient,
			amount
		}))
	}

	private minimumFirstWithdrawalAmount(): UInt64 {
		return this.l1AccountCreationFee.add(this.bridgeProofFee)
	}

	private async pollQuery(key: string, pollPeriod = 5_000): Promise<string> {
		this.debug("pollQuery", { key })

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
		signTxn: (txn: Transaction<boolean, false>) => Promise<Transaction<boolean, true>>
	): Promise<string> {
		this.setL1()

		await refreshCache(recipient)
		await refreshCache(feePayer)
		await refreshCache(this.outerPk)

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount.add(this.bridgeProofFee))
			transferrer.body.actions = Actions.pushAction(transferrer.body.actions, [
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
			actionWitness.body.actions = Actions.pushAction(actionWitness.body.actions, [
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
				verificationKeyHash: await getVkHash(this.outerPk)
			}

			AccountUpdate.attachToTransaction(actionWitness)
		})

		const signed = await signTxn(txn)

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
		this.setL2()

		const context = await this.fetchDepositStateContext(pk)

		if (context.depositsByAux.size === 0) {
			return { ok: false, msg: "No deposits found" }
		}

		if (context.depositWitnesses.length === 0) {
			return { ok: false, msg: "No deposit witnesses found" }
		}

		if (context.lastCommit === null) {
			return { ok: false, msg: NO_OUTER_COMMIT_REASON }
		}

		const minDepositIndex = uint32Max(this.V2_DEPOSITS_START_INDEX, context.prevNextDeposit)

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
					index: witness.index,
					value: finalizationWitness
				}
			}

			return {
				ok: false,
				msg: "Deposit is not finalizable yet; an earlier deposit must be resolved first"
			}
		}

		return { ok: false, msg: "No finalizable deposit found" }
	}

	public async finalizeDeposit(
		pk: PublicKey,
		signTxn: (txn: Transaction<boolean, false>) => Promise<Transaction<boolean, true>>,
		options?: number | RetryableTransactionOptions
	): Promise<string> {
		const { attempts, fee } = normalizeRetryableTransactionOptions(options)
		const prove = async (attempts: number) => {
			if (attempts === 0) throw new Error("Failed to prove deposit finalization")

			const witnesses = await this.fetchDepositFinalizationWitnesses(pk)

			if (!witnesses.ok) throw new Error(witnesses.msg)

			const { witness, depositParams, aseTarget } = witnesses.value

			this.setL2()
			await refreshCache(depositParams.deposit.recipient)
			await refreshCache(depositParams.deposit.recipient, TokenId.derive(this.innerHolder))
			await refreshCache(this.innerHolder)

			let isHelperAccountNew = false
			const txn = await Mina.transaction(
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
					Provable.asProver(() => {
						isHelperAccountNew = helperAccount.body.preconditions.account.isNew.value.toBoolean()
					})
					helperAccount.body.preconditions.account.state[0] = {
						isSome: Bool(true),
						value: Field(witness.prevNextDeposit)
					}
					helperAccount.account.nonce.getAndRequireEquals()

					const innerWitness = AccountUpdate.create(this.innerPk)
					innerWitness.body.useFullCommitment = Bool(true)
					innerWitness.body.implicitAccountCreationFee = Bool(true)
					innerWitness.body.mayUseToken = {
						parentsOwnToken: Bool(false),
						inheritFromParent: Bool(false)
					}
					innerWitness.body.preconditions.account.state[0] = {
						isSome: Bool(true),
						value: aseTarget.state
					}
					innerWitness.body.preconditions.account.state[1] = {
						isSome: Bool(true),
						value: aseTarget.length.toFields()[0]
					}

					const recipientPayout = AccountUpdate.create(depositParams.deposit.recipient)
					recipientPayout.body.useFullCommitment = Bool(true)
					recipientPayout.body.implicitAccountCreationFee = Bool(true)
					recipientPayout.body.mayUseToken = {
						parentsOwnToken: Bool(true),
						inheritFromParent: Bool(false)
					}
					let payout = depositParams.deposit.amount
					payout = payout.sub(this.bridgeProofFee)
					if (isHelperAccountNew) payout = payout.sub(this.l2AccountCreationFee)
					recipientPayout.balance.addInPlace(payout)

					const feePayout = AccountUpdate.create(this.bridgeFeeRecipientL2)
					feePayout.body.useFullCommitment = Bool(true)
					feePayout.body.implicitAccountCreationFee = Bool(true)
					feePayout.body.mayUseToken = {
						parentsOwnToken: Bool(true),
						inheritFromParent: Bool(false)
					}
					feePayout.balance.addInPlace(this.bridgeProofFee)

					const finalizeDeposit = AccountUpdate.create(this.innerHolder)
					finalizeDeposit.approve(helperAccount)
					finalizeDeposit.approve(innerWitness)
					finalizeDeposit.approve(recipientPayout)
					finalizeDeposit.approve(feePayout)
					finalizeDeposit.body.useFullCommitment = Bool(true)
					finalizeDeposit.body.implicitAccountCreationFee = Bool(true)
					finalizeDeposit.body.mayUseToken = {
						parentsOwnToken: Bool(false),
						inheritFromParent: Bool(false)
					}
					finalizeDeposit.balance.subInPlace(depositParams.deposit.amount)
					finalizeDeposit.body.events = Events.pushEvent(finalizeDeposit.body.events, [
						Field(witness.checkAccepted.init.depositIndex),
						Field(0), // empty children
						...PublicKey.fromBase58(witness.checkAccepted.init.params.holderAccountL1).toFields(),
						...UInt64.from(witness.checkAccepted.init.params.amount).toFields(),
						...PublicKey.fromBase58(witness.checkAccepted.init.params.recipient).toFields(),
						...UInt32.from(witness.checkAccepted.init.params.timeout).toFields()
					])
					finalizeDeposit.body.authorizationKind = {
						isSigned: Bool(false),
						isProved: Bool(true),
						verificationKeyHash: await getVkHash(this.innerHolder)
					}
					AccountUpdate.attachToTransaction(finalizeDeposit)
				}
			)

			const signed = await signTxn(txn)
			const helperAccountUpdate = signed.transaction.accountUpdates.find(
				({ publicKey, tokenId }) =>
					publicKey.equals(depositParams.deposit.recipient).toBoolean() &&
					tokenId.equals(TokenId.derive(this.innerHolder)).toBoolean()
			)
			if (!helperAccountUpdate) throw new Error("Helper account update not found")

			const helperAccountNonce =
				helperAccountUpdate.body.preconditions.account.nonce.value.lower.toString()

			const helperAccountSignatureString = helperAccountUpdate.authorization.signature
			if (!helperAccountSignatureString) throw new Error("Helper account update not signed")
			const helperAccountSignature = Signature.fromBase58(helperAccountSignatureString)

			const { data, error } = await this.l2Client().mutation(finalizeDepositMutation, {
				input: {
					...witness,
					prevNonce: helperAccountNonce,
					helperAccountSignature: {
						scalar: helperAccountSignature.s.toBigInt().toString(),
						field: helperAccountSignature.r.toBigInt().toString()
					},
					helperAccountNew: isHelperAccountNew
				}
			})
			if (!data?.request?.key) throw new Error(error?.message ?? "No key returned from mutation")
			const txnHash = await this.pollQuery(data.request.key)

			const currentSyncedOuterActionState = await this.fetchSyncedOuterActionState()

			if (currentSyncedOuterActionState.state.equals(aseTarget.state).toBoolean()) {
				return txnHash
			}
			return await prove(attempts - 1)
		}

		return await prove(attempts)
	}

	public async canFinalizeDeposit(
		pk: PublicKey
	): Promise<{ available: boolean; reason: string | null; index?: number }> {
		this.debug("canFinalizeDeposit start", { pk: pk.toBase58() })
		const result = await this.fetchDepositFinalizationWitnesses(pk)
		this.debug("canFinalizeDeposit result", result)
		return {
			available: result.ok,
			reason: result.ok ? null : result.msg,
			index: result.index
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
			lastCommitIndex:
				lastCommit === null
					? -1
					: outerActions.findIndex(({ index }) => lastCommit.index === index),
			commitAseTarget:
				ase.at(-1)?.afterActionState ??
				lastCommit?.afterActionState ??
				syncedOuterActionState.state,
			synchronizedOuterActionStateIndex:
				lastCommit === null
					? -1
					: outerActions.findIndex(({ index }) =>
							lastCommit.synchronizedOuterActionStateLength
								.equals(UInt32.from(index + 1))
								.toBoolean()
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
		const minDepositIndex = uint32Max(this.V2_DEPOSITS_START_INDEX, context.prevNextDeposit)

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
		const depositActionIndex = context.outerActions.findIndex(
			(action) =>
				action.type === "witness" &&
				action.index === witness.index &&
				action.aux.equals(witness.aux).toBoolean()
		)
		const acceptanceActions =
			depositActionIndex === -1
				? context.outerActions
				: context.outerActions.slice(depositActionIndex + 1)

		const { isRejected, isAccepted } = checkAccepted(
			acceptanceActions,
			UInt32.from(witness.index),
			depositParams.deposit
		)

		const cancelled = isRejected && this.isDepositCancelled(context, witness)
		const synced = context.syncedOuterActionState.length
			.greaterThanOrEqual(UInt32.from(witness.index + 1))
			.toBoolean()
		const accepted = context.lastCommit !== null && context.lastCommit.index >= witness.index
		const confirmed =
			context.lastCommit === null
				? false
				: context.lastCommit.synchronizedOuterActionStateLength
						.greaterThanOrEqual(UInt32.from(witness.index + 1))
						.toBoolean()
		const finalised = isAccepted && this.isDepositFinalised(context, witness)

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

		const { isRejected, isAccepted } = checkAccepted(
			context.outerActions,
			UInt32.from(witness.index),
			depositParams.deposit
		)

		const cancelled = isRejected && this.isDepositCancelled(context, witness)
		const finalised = isAccepted && this.isDepositFinalised(context, witness)

		if (cancelled || finalised) return null

		const minDepositIndex = uint32Max(
			this.V2_DEPOSITS_START_INDEX,
			context.prevNextCancelledDeposit
		)

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

		if (context.lastCommit === null) return null

		if (context.synchronizedOuterActionStateIndex === -1) return null

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

	private async fetchDepositCancellationWitnesses(
		pk: PublicKey,
		outerHolder: PublicKey
	): Promise<
		WitnessFetchResult<{
			commitAseTarget: Field
			depositParams: {
				deposit: Deposit
				aux: Field
			}
			helperAccount: Account | null
			witness: ExtractInput<typeof cancelDepositMutation>
		}>
	> {
		const context = await this.fetchDepositStateContext(pk)

		if (context.depositsByAux.size === 0) {
			return { ok: false, msg: "No deposits found" }
		}

		if (context.depositWitnesses.length === 0) {
			return { ok: false, msg: "No deposit witnesses found" }
		}

		const sortedWitnesses = this.getSortedDepositWitnesses(context)

		for (const witness of sortedWitnesses) {
			const depositParams = this.getDepositParamsForWitness(context, witness)

			const witnessInput = this.buildDepositCancellationWitnessInput(context, witness)
			if (!witnessInput) continue

			return {
				ok: true,
				value: {
					commitAseTarget: context.commitAseTarget,
					depositParams,
					helperAccount: context.helperAccountL1,
					witness: {
						publicKey: outerHolder.toBase58(),
						...witnessInput
					}
				}
			}
		}

		return { ok: false, msg: "No cancellable deposit found" }
	}

	public async cancelDeposit(
		pk: PublicKey,
		signTxn: (txn: Transaction<boolean, false>) => Promise<Transaction<boolean, true>>,
		_outerHolder?: PublicKey,
		options?: RetryableTransactionOptions
	): Promise<string> {
		const { fee } = normalizeRetryableTransactionOptions(options)
		this.debug("cancelDeposit start", { pk: pk.toBase58() })
		const outerHolder = _outerHolder ?? this.outerHolders[0]
		const witnesses = await this.fetchDepositCancellationWitnesses(pk, outerHolder)
		this.debug("cancelDeposit witnesses", witnesses)

		if (!witnesses.ok) throw new Error("Did not find deposit to cancel")

		const { witness, depositParams, commitAseTarget } = witnesses.value

		this.setL1()
		await refreshCache(depositParams.deposit.recipient)
		await refreshCache(depositParams.deposit.recipient, TokenId.derive(this.outerTokenOwner))
		await refreshCache(this.outerTokenOwner)
		await refreshCache(outerHolder)

		let isHelperAccountNew = false
		const txn = await Mina.transaction(
			{
				sender: this.sequencerPk,
				fee
			},
			async () => {
				const helperAccount = AccountUpdate.createSigned(
					depositParams.deposit.recipient,
					TokenId.derive(this.outerTokenOwner)
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
					value: Field(witness.checkAccepted.init.depositIndex).add(1)
				}
				helperAccount.account.isNew.getAndRequireEquals()
				Provable.asProver(() => {
					isHelperAccountNew = helperAccount.body.preconditions.account.isNew.value.toBoolean()
				})
				helperAccount.body.preconditions.account.state[0] = {
					isSome: Bool(true),
					value: Field(witness.prevNextCancelledDeposit)
				}
				helperAccount.account.nonce.getAndRequireEquals()

				const tokenOwner = AccountUpdate.create(this.outerTokenOwner)
				tokenOwner.approve(helperAccount)
				tokenOwner.body.useFullCommitment = Bool(true)
				tokenOwner.body.implicitAccountCreationFee = Bool(true)
				tokenOwner.body.mayUseToken = {
					parentsOwnToken: Bool(false),
					inheritFromParent: Bool(false)
				}
				tokenOwner.body.authorizationKind = {
					isSigned: Bool(false),
					isProved: Bool(true),
					verificationKeyHash: await getVkHash(this.outerTokenOwner)
				}

				const outerWitness = AccountUpdate.create(this.outerPk)
				outerWitness.body.useFullCommitment = Bool(true)
				outerWitness.body.implicitAccountCreationFee = Bool(true)
				outerWitness.body.mayUseToken = {
					parentsOwnToken: Bool(false),
					inheritFromParent: Bool(false)
				}
				outerWitness.body.preconditions.account.state[1] = {
					isSome: Bool(true),
					value: Field(0) // status flags
				}
				outerWitness.body.preconditions.account.actionState = {
					isSome: Bool(true),
					value: commitAseTarget
				}

				const recipientPayout = AccountUpdate.create(depositParams.deposit.recipient)
				recipientPayout.body.useFullCommitment = Bool(true)
				recipientPayout.body.implicitAccountCreationFee = Bool(true)
				recipientPayout.body.mayUseToken = {
					parentsOwnToken: Bool(true),
					inheritFromParent: Bool(false)
				}
				let payout = depositParams.deposit.amount
				payout = payout.sub(this.bridgeProofFee)
				if (isHelperAccountNew) payout = payout.sub(this.l1AccountCreationFee)
				recipientPayout.balance.addInPlace(payout)

				const feePayout = AccountUpdate.create(this.bridgeFeeRecipientL1)
				feePayout.body.useFullCommitment = Bool(true)
				feePayout.body.implicitAccountCreationFee = Bool(true)
				feePayout.body.mayUseToken = {
					parentsOwnToken: Bool(true),
					inheritFromParent: Bool(false)
				}
				feePayout.balance.addInPlace(this.bridgeProofFee)

				const cancelDeposit = AccountUpdate.create(outerHolder)
				cancelDeposit.approve(tokenOwner)
				cancelDeposit.approve(outerWitness)
				cancelDeposit.approve(recipientPayout)
				cancelDeposit.approve(feePayout)
				cancelDeposit.body.useFullCommitment = Bool(true)
				cancelDeposit.body.implicitAccountCreationFee = Bool(true)
				cancelDeposit.body.mayUseToken = {
					parentsOwnToken: Bool(false),
					inheritFromParent: Bool(false)
				}
				cancelDeposit.balance.subInPlace(depositParams.deposit.amount)
				cancelDeposit.body.authorizationKind = {
					isSigned: Bool(false),
					isProved: Bool(true),
					verificationKeyHash: await getVkHash(outerHolder)
				}
				AccountUpdate.attachToTransaction(cancelDeposit)
			}
		)

		const signed = await signTxn(txn)
		const helperAccountUpdate = signed.transaction.accountUpdates.find(
			({ publicKey, tokenId }) =>
				publicKey.equals(depositParams.deposit.recipient).toBoolean() &&
				tokenId.equals(TokenId.derive(this.outerTokenOwner)).toBoolean()
		)
		if (!helperAccountUpdate) throw new Error("Helper account update not found")

		const helperAccountNonce =
			helperAccountUpdate.body.preconditions.account.nonce.value.lower.toString()

		const helperAccountSignatureString = helperAccountUpdate.authorization.signature
		if (!helperAccountSignatureString) throw new Error("Helper account update not signed")
		const helperAccountSignature = Signature.fromBase58(helperAccountSignatureString)

		const { data, error } = await this.l2Client().mutation(cancelDepositMutation, {
			input: {
				...witness,
				prevNonce: helperAccountNonce,
				helperAccountSignature: {
					scalar: helperAccountSignature.s.toBigInt().toString(),
					field: helperAccountSignature.r.toBigInt().toString()
				},
				helperAccountNew: isHelperAccountNew
			}
		})
		if (!data?.request?.key) throw new Error(error?.message ?? "No key returned from mutation")
		this.debug("cancelDeposit mutation key", { key: data.request.key })

		return await this.pollQuery(data.request.key)
	}

	public async canCancelDeposit(
		pk: PublicKey
	): Promise<{ available: boolean; reason: string | null }> {
		const result = await this.fetchDepositsWithStates(pk)
		const available = result.deposits.some((deposit) => deposit.cancellable)
		this.debug("canCancelDeposit result", {
			pk: pk.toBase58(),
			available,
			depositCount: result.deposits.length
		})
		return {
			available,
			reason: available ? null : "No cancellable deposit found"
		}
	}

	public async submitWithdrawal(
		feePayer: Mina.FeePayerSpec,
		{
			recipient,
			amount
		}: {
			recipient: PublicKey
			amount: UInt64
		},
		signTxn: (txn: Transaction<boolean, false>) => Promise<Transaction<boolean, true>>
	): Promise<string> {
		this.setL2()

		await ensureFirstWithdrawalAmountCanCreateHelper({
			amount,
			recipient,
			accountCreationFee: this.minimumFirstWithdrawalAmount(),
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
		await refreshCache(this.innerPk)
		await refreshCache(this.bridgeFeeRecipientL2)

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount.add(this.bridgeProofFee))
			transferrer.body.actions = Actions.pushAction(transferrer.body.actions, [
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
				verificationKeyHash: await getVkHash(this.innerHolder)
			}

			const feePayout = AccountUpdate.create(this.bridgeFeeRecipientL2)
			feePayout.balance.addInPlace(this.bridgeProofFee)
			feePayout.body.useFullCommitment = Bool(true)
			feePayout.body.implicitAccountCreationFee = Bool(true)
			feePayout.body.mayUseToken = {
				parentsOwnToken: Bool(true),
				inheritFromParent: Bool(false)
			}

			const childrenHash = AccountUpdateForest.fromFlatArray([receiver, feePayout]).hash

			const actionWitness = AccountUpdate.create(this.innerPk)
			actionWitness.approve(receiver)
			actionWitness.approve(feePayout)
			actionWitness.body.actions = Actions.pushAction(actionWitness.body.actions, [
				Field(0), // tag
				withdrawalAux({
					recipient,
					amount
				}), // aux
				childrenHash // children hash
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
				verificationKeyHash: await getVkHash(this.innerPk)
			}

			AccountUpdate.attachToTransaction(actionWitness)
		})

		const signed = await signTxn(txn)
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

	private async fetchWithdrawalFinalizationWitnesses(
		pk: PublicKey,
		outerHolder: PublicKey
	): Promise<
		WitnessFetchResult<{
			commitAseTarget: Field
			commitSlotRange: {
				lower: UInt32
				upper: UInt32
			}
			withdrawalParams: {
				withdrawal: Withdrawal
				aux: Field
			}
			helperAccount: Account | null
			witness: ExtractInput<typeof finalizeWithdrawalMutation>
		}>
	> {
		const helperAccount = await this.fetchAccount(
			this.l1Client,
			pk,
			TokenId.derive(this.outerTokenOwner)
		)
		this.debug("fetchWithdrawalFinalizationWitnesses helperAccount", {
			pk: pk.toBase58(),
			hasHelperAccount: helperAccount !== null
		})

		const prevNextWithdrawal = helperAccount ? getNextWithdrawalIndex(helperAccount) : UInt32.zero
		this.debug("fetchWithdrawalFinalizationWitnesses prevNextWithdrawal", {
			prevNextWithdrawal: prevNextWithdrawal.toString()
		})

		const withdrawals = (await this.fetchUserWithdrawals(pk)).map((withdrawal) => ({
			withdrawal,
			aux: withdrawalAux(withdrawal)
		}))
		this.debug("fetchWithdrawalFinalizationWitnesses withdrawals", {
			count: withdrawals.length,
			recipients: withdrawals.map(({ withdrawal }) => withdrawal.recipient.toBase58()),
			amounts: withdrawals.map(({ withdrawal }) => withdrawal.amount.toString())
		})

		if (withdrawals.length === 0) {
			this.debug("fetchWithdrawalFinalizationWitnesses no-withdrawals", {
				pk: pk.toBase58()
			})
			return { ok: false, msg: "No withdrawals found" }
		}

		const withdrawalWitnesses = await fetchInnerWitnessesFromAuxes(
			this.actionsApiClient,
			withdrawals.map(({ aux }) => aux.toString())
		)
		this.debug("fetchWithdrawalFinalizationWitnesses witnessFetch", {
			requestedAuxes: withdrawals.length,
			witnessCount: withdrawalWitnesses.length,
			witnessIndices: withdrawalWitnesses.map((witness) => witness.index)
		})

		if (withdrawalWitnesses.length === 0) {
			this.debug("fetchWithdrawalFinalizationWitnesses no-witnesses", {
				pk: pk.toBase58(),
				withdrawalCount: withdrawals.length
			})
			return { ok: false, msg: "No withdrawal witnesses found" }
		}

		const earliestBeforeState = withdrawalWitnesses
			.sort((a, b) => a.index - b.index)
			.at(0)?.beforeActionState
		this.debug("fetchWithdrawalFinalizationWitnesses earliestBeforeState", {
			earliestBeforeState: earliestBeforeState?.toString() ?? null
		})

		if (earliestBeforeState === undefined) {
			return { ok: false, msg: "No earliest before state found" }
		}

		const currentSlot = await this.fetchCurrentSlot()
		this.debug("fetchWithdrawalFinalizationWitnesses currentSlot", {
			currentSlot: currentSlot.toString(),
			withdrawalDelay: this.withdrawalDelay.toString(),
			targetSlot: currentSlot.sub(this.withdrawalDelay).toString()
		})

		const { commit: lastCommit, ase } = await fetchCommitAsePastSlot(
			this.actionsApiClient,
			+currentSlot.sub(this.withdrawalDelay)
		)
		if (lastCommit === null) {
			this.debug("fetchWithdrawalFinalizationWitnesses no-outer-commit", {
				aseCount: ase.length
			})
			return { ok: false, msg: NO_OUTER_COMMIT_REASON, status: "waiting" }
		}
		this.debug("fetchWithdrawalFinalizationWitnesses commitAsePastSlot", {
			aseCount: ase.length,
			innerActionState: lastCommit.innerActionState.toString(),
			innerActionStateLength: lastCommit.innerActionStateLength.toString(),
			afterActionState: lastCommit.afterActionState.toString()
		})

		const lastCommitAse = ase.map(({ action }) => fromList([action]).hash)
		const commitAseTarget = ase.at(-1)?.afterActionState ?? lastCommit.afterActionState

		const innerActions = await fetchInnerActionsFromIndexer(this.actionsApiClient, {
			fromState: earliestBeforeState.toString(),
			afterState: lastCommit.innerActionState.toString()
		})
		this.debug("fetchWithdrawalFinalizationWitnesses innerActions", {
			count: innerActions.length,
			indices: innerActions.map((action) => action.index)
		})

		const findMatchingWithdrawal = (action: InnerWitness) =>
			withdrawals.find(({ aux }) => aux.equals(action.aux).toBoolean())

		const matchingWitnesses = withdrawalWitnesses.filter((witness) =>
			Boolean(findMatchingWithdrawal(witness))
		)
		const alreadyFinalisedWitnessIndices = matchingWitnesses
			.filter((witness) => prevNextWithdrawal.greaterThan(UInt32.from(witness.index)).toBoolean())
			.map((witness) => witness.index)
		const alreadyFinalisedWitnessCount = alreadyFinalisedWitnessIndices.length
		const unfinalisedWitnessCount = matchingWitnesses.length - alreadyFinalisedWitnessCount
		let insufficientFirstWithdrawalReason: string | null = null
		let alreadyFinalisedCount = 0
		let alreadyFinalisedIndex: number | undefined
		let unfinalisedMatchCount = 0

		const minWithdrawalIndex = uint32Max(this.V2_WITHDRAWALS_START_INDEX, prevNextWithdrawal)

		const myWithdrawalIndex = innerActions.findIndex((action) => {
			const matchingWithdrawal = findMatchingWithdrawal(action)

			if (!matchingWithdrawal) return false

			if (prevNextWithdrawal.greaterThan(UInt32.from(action.index)).toBoolean()) {
				alreadyFinalisedCount++
				alreadyFinalisedIndex = Math.max(alreadyFinalisedIndex ?? action.index, action.index)
				return false
			}

			if (minWithdrawalIndex.greaterThan(UInt32.from(action.index)).toBoolean()) return false

			unfinalisedMatchCount++

			if (action.index === 3) return false

			try {
				assertFirstWithdrawalAmountCanCreateHelper({
					helperAccountExists: helperAccount !== null,
					amount: matchingWithdrawal.withdrawal.amount,
					recipient: matchingWithdrawal.withdrawal.recipient,
					accountCreationFee: this.minimumFirstWithdrawalAmount()
				})
			} catch (e) {
				if (e instanceof InsufficientFirstWithdrawalAmountError) {
					insufficientFirstWithdrawalReason ??= e.message
					return false
				}
				throw e
			}

			return true
		})
		this.debug("fetchWithdrawalFinalizationWitnesses myWithdrawalIndex", {
			myWithdrawalIndex,
			prevNextWithdrawal: prevNextWithdrawal.toString()
		})

		if (myWithdrawalIndex === -1) {
			this.debug("fetchWithdrawalFinalizationWitnesses no-my-withdrawal", {
				prevNextWithdrawal: prevNextWithdrawal.toString(),
				innerActionIndices: innerActions.map((action) => action.index)
			})
			if (insufficientFirstWithdrawalReason) {
				return { ok: false, msg: insufficientFirstWithdrawalReason, status: "blocked" }
			}
			if (
				(alreadyFinalisedCount > 0 && unfinalisedMatchCount === 0) ||
				(alreadyFinalisedWitnessCount > 0 && unfinalisedWitnessCount === 0)
			) {
				return {
					ok: false,
					msg: "Withdrawal already finalised",
					status: "alreadyFinalised",
					index: alreadyFinalisedIndex ?? Math.max(...alreadyFinalisedWitnessIndices)
				}
			}
			return { ok: false, msg: "No my withdrawal index found", status: "waiting" }
		}

		const myWithdrawal = innerActions[myWithdrawalIndex]
		const withdrawalParams = findMatchingWithdrawal(myWithdrawal)
		if (!withdrawalParams) throw new Error("Unreachable: Did not find withdrawal parameters")
		this.debug("fetchWithdrawalFinalizationWitnesses selectedWithdrawal", {
			index: myWithdrawal.index,
			actionHash: myWithdrawal.hash,
			recipient: withdrawalParams.withdrawal.recipient.toBase58(),
			amount: withdrawalParams.withdrawal.amount.toString()
		})
		try {
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: helperAccount !== null,
				amount: withdrawalParams.withdrawal.amount,
				recipient: withdrawalParams.withdrawal.recipient,
				accountCreationFee: this.minimumFirstWithdrawalAmount()
			})
		} catch (e) {
			if (e instanceof InsufficientFirstWithdrawalAmountError) {
				return { ok: false, msg: e.message }
			}
			throw e
		}

		const withdrawalAse = innerActions
			.slice(myWithdrawalIndex + 1)
			.map(({ action }) => fromList([action]).hash)

		return {
			ok: true,
			index: myWithdrawal.index,
			value: {
				commitAseTarget,
				commitSlotRange: lastCommit.slotRange,
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
							actionState: myWithdrawal.afterActionState.toString()
						}
					},
					beforeWithdrawal: {
						actionState: myWithdrawal.beforeActionState.toString()
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
	}

	public async finalizeWithdrawal(
		pk: PublicKey,
		signTxn: (txn: Transaction<boolean, false>) => Promise<Transaction<boolean, true>>,
		_outerHolder?: PublicKey,
		options?: RetryableTransactionOptions
	): Promise<string> {
		const { fee } = normalizeRetryableTransactionOptions(options)
		const outerHolder = _outerHolder ?? this.outerHolders[0]
		const witnesses = await this.fetchWithdrawalFinalizationWitnesses(pk, outerHolder)

		if (!witnesses.ok) throw new Error("Did not find any withdrawal to finalize")

		const { witness, withdrawalParams, commitAseTarget, commitSlotRange } = witnesses.value

		this.setL1()
		await refreshCache(withdrawalParams.withdrawal.recipient)
		await refreshCache(withdrawalParams.withdrawal.recipient, TokenId.derive(this.outerTokenOwner))
		await refreshCache(this.outerTokenOwner)
		await refreshCache(outerHolder)

		const withdrawalIndex = Field(witness.withdrawalAse.stmt.length).sub(1)

		let isHelperAccountNew = false
		const txn = await Mina.transaction(
			{
				sender: this.sequencerPk,
				fee
			},
			async () => {
				const helperAccount = AccountUpdate.createSigned(
					withdrawalParams.withdrawal.recipient,
					TokenId.derive(this.outerTokenOwner)
				)
				helperAccount.body.useFullCommitment = Bool(false)
				helperAccount.body.incrementNonce = Bool(true)
				helperAccount.body.implicitAccountCreationFee = Bool(false)
				helperAccount.body.mayUseToken = {
					parentsOwnToken: Bool(true),
					inheritFromParent: Bool(false)
				}
				helperAccount.body.update.appState[1] = {
					isSome: Bool(true),
					value: withdrawalIndex.add(1) // next withdrawal
				}
				helperAccount.account.isNew.getAndRequireEquals()
				Provable.asProver(() => {
					isHelperAccountNew = helperAccount.body.preconditions.account.isNew.value.toBoolean()
				})
				helperAccount.body.preconditions.account.state[1] = {
					isSome: Bool(true),
					value: Field(witness.prevNextWithdrawal)
				}
				helperAccount.account.nonce.getAndRequireEquals()

				const tokenOwner = AccountUpdate.create(this.outerTokenOwner)
				tokenOwner.approve(helperAccount)
				tokenOwner.body.useFullCommitment = Bool(true)
				tokenOwner.body.implicitAccountCreationFee = Bool(true)
				tokenOwner.body.mayUseToken = {
					parentsOwnToken: Bool(false),
					inheritFromParent: Bool(false)
				}
				tokenOwner.body.authorizationKind = {
					isSigned: Bool(false),
					isProved: Bool(true),
					verificationKeyHash: await getVkHash(this.outerTokenOwner)
				}

				const outerWitness = AccountUpdate.create(this.outerPk)
				outerWitness.body.useFullCommitment = Bool(true)
				outerWitness.body.implicitAccountCreationFee = Bool(true)
				outerWitness.body.mayUseToken = {
					parentsOwnToken: Bool(false),
					inheritFromParent: Bool(false)
				}
				outerWitness.body.preconditions.account.state[1] = {
					isSome: Bool(true),
					value: Field(0) // status flags
				}
				outerWitness.body.preconditions.account.actionState = {
					isSome: Bool(true),
					value: commitAseTarget
				}
				outerWitness.body.preconditions.validWhile = {
					isSome: Bool(true),
					value: {
						lower: commitSlotRange.upper.add(this.withdrawalDelay),
						upper: UInt32.from(4294967295)
					}
				}

				const recipientPayout = AccountUpdate.create(withdrawalParams.withdrawal.recipient)
				recipientPayout.body.useFullCommitment = Bool(true)
				recipientPayout.body.implicitAccountCreationFee = Bool(true)
				recipientPayout.body.mayUseToken = {
					parentsOwnToken: Bool(true),
					inheritFromParent: Bool(false)
				}
				let payout = withdrawalParams.withdrawal.amount
				payout = payout.sub(this.bridgeProofFee)
				if (isHelperAccountNew) payout = payout.sub(this.l1AccountCreationFee)
				recipientPayout.balance.addInPlace(payout)

				const feePayout = AccountUpdate.create(this.bridgeFeeRecipientL1)
				feePayout.body.useFullCommitment = Bool(true)
				feePayout.body.implicitAccountCreationFee = Bool(true)
				feePayout.body.mayUseToken = {
					parentsOwnToken: Bool(true),
					inheritFromParent: Bool(false)
				}
				feePayout.balance.addInPlace(this.bridgeProofFee)

				const finalizeWithdrawal = AccountUpdate.create(outerHolder)
				finalizeWithdrawal.approve(tokenOwner)
				finalizeWithdrawal.approve(outerWitness)
				finalizeWithdrawal.approve(recipientPayout)
				finalizeWithdrawal.approve(feePayout)
				finalizeWithdrawal.body.useFullCommitment = Bool(true)
				finalizeWithdrawal.body.implicitAccountCreationFee = Bool(true)
				finalizeWithdrawal.body.mayUseToken = {
					parentsOwnToken: Bool(false),
					inheritFromParent: Bool(false)
				}
				finalizeWithdrawal.balance.subInPlace(withdrawalParams.withdrawal.amount)
				finalizeWithdrawal.body.events = Events.pushEvent(finalizeWithdrawal.body.events, [
					withdrawalIndex,
					Field(0), // empty children
					...UInt64.from(withdrawalParams.withdrawal.amount).toFields(),
					...withdrawalParams.withdrawal.recipient.toFields()
				])
				finalizeWithdrawal.body.authorizationKind = {
					isSigned: Bool(false),
					isProved: Bool(true),
					verificationKeyHash: await getVkHash(outerHolder)
				}
				AccountUpdate.attachToTransaction(finalizeWithdrawal)
			}
		)

		const signed = await signTxn(txn)
		const helperAccountUpdate = signed.transaction.accountUpdates.find(
			({ publicKey, tokenId }) =>
				publicKey.equals(withdrawalParams.withdrawal.recipient).toBoolean() &&
				tokenId.equals(TokenId.derive(this.outerTokenOwner)).toBoolean()
		)
		if (!helperAccountUpdate) throw new Error("Helper account update not found")

		const helperAccountNonce =
			helperAccountUpdate.body.preconditions.account.nonce.value.lower.toString()

		const helperAccountSignatureString = helperAccountUpdate.authorization.signature
		if (!helperAccountSignatureString) throw new Error("Helper account update not signed")
		const helperAccountSignature = Signature.fromBase58(helperAccountSignatureString)

		const { data, error } = await this.l2Client().mutation(finalizeWithdrawalMutation, {
			input: {
				...witness,
				prevNonce: helperAccountNonce,
				helperAccountSignature: {
					scalar: helperAccountSignature.s.toBigInt().toString(),
					field: helperAccountSignature.r.toBigInt().toString()
				},
				helperAccountNew: isHelperAccountNew
			}
		})
		if (!data?.request?.key) throw new Error(error?.message ?? "No key returned from mutation")

		return await this.pollQuery(data.request.key)
	}

	public async canFinalizeWithdrawal(pk: PublicKey): Promise<WithdrawalFinalizationResult> {
		this.debug("canFinalizeWithdrawal start", { pk: pk.toBase58() })
		const result = await this.fetchWithdrawalFinalizationWitnesses(pk, this.outerTokenOwner)
		this.debug("canFinalizeWithdrawal result", result)
		return {
			available: result.ok,
			reason: result.ok ? null : result.msg,
			status: result.ok ? "available" : result.status ?? "waiting",
			index: result.index
		}
	}

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
			acceptedIndex: context.lastCommit?.index ?? -1,
			confirmedIndex:
				context.lastCommit === null
					? -1
					: +safeDecrement(context.lastCommit.synchronizedOuterActionStateLength).toString(),
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

		const normalizeTimestamp = (timestamp: string) => (timestamp === "0" ? "" : timestamp)

		const witnessedAuxes = new Set(
			withdrawalWitnesses.map((witness) => witness.aux.toBigInt().toString())
		)
		const provisionalWithdrawals = withdrawals
			.filter((withdrawal) => !witnessedAuxes.has(withdrawalAux(withdrawal).toBigInt().toString()))
			.map((withdrawal, index, pending) => ({
				...withdrawal,
				timestamp: normalizeTimestamp(withdrawal.timestamp),
				index: -(pending.length - index),
				committed: false,
				finalised: false
			}))

		return {
			withdrawals: [
				...withdrawalWitnesses.map((witness) => {
					const withdrawal = auxesMap.get(witness.aux.toBigInt())
					if (!withdrawal) throw new Error("Unreachable: Did not find withdrawal")
					return {
						...withdrawal,
						...witness,
						timestamp: normalizeTimestamp(witness.timestamp),
						committed:
							lastCommit === null
								? false
								: lastCommit.innerActionStateLength
										.greaterThan(UInt32.from(witness.index))
										.toBoolean(),
						finalised: nextWithdrawal.greaterThanOrEqual(UInt32.from(witness.index + 1)).toBoolean()
					}
				}),
				...provisionalWithdrawals
			],
			committedIndex:
				lastCommit === null ? -1 : +safeDecrement(lastCommit.innerActionStateLength).toString(),
			finalisedIndex: +safeDecrement(nextWithdrawal).toString()
		}
	}
}
