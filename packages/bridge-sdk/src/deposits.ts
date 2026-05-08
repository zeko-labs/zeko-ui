import { finalizeDepositMutation, submitDepositMutation } from "@zeko-labs/graphql"
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
	UInt64
} from "o1js"
import { Actions, Events, fromList } from "./actions"
import { buildDepositCancellationWitnessInput } from "./cancellations"
import {
	fetchDepositStateContext,
	fetchSyncedOuterActionState,
	getDepositParamsForWitness,
	getSortedDepositWitnesses,
	isDepositCancelled,
	isDepositFinalised,
	type DepositStateContext
} from "./deposit-state"
import { setL1, setL2 } from "./network"
import { pollProvingResult } from "./prover"
import { debug, type BridgeRuntime } from "./runtime"
import {
	normalizeRetryableTransactionOptions,
	type RetryableTransactionOptions,
	type SignTransaction
} from "./transactions"
import type {
	Account,
	Deposit,
	DepositWithState,
	ExtractInput,
	OuterCommit,
	OuterWitness,
	WitnessFetchResult
} from "./types"
import { checkAccepted, depositAux, getVkHash, refreshCache, safeDecrement } from "./utils"

export async function submitDeposit(
	runtime: BridgeRuntime,
	feePayer: Mina.FeePayerSpec,
	{
		recipient,
		amount,
		timeout,
		holderAccountL1 = runtime.outerHolders[0]
	}: {
		recipient: PublicKey
		amount: UInt64
		timeout: UInt32
		holderAccountL1?: PublicKey
	},
	signTxn: SignTransaction
): Promise<string> {
	setL1(runtime)

	await refreshCache(recipient)
	await refreshCache(feePayer)
	await refreshCache(runtime.outerPk)

	const txn = await Mina.transaction(feePayer, async () => {
		const transferrer = AccountUpdate.createSigned(recipient)
		transferrer.balance.subInPlace(amount.add(runtime.bridgeProofFee))
		transferrer.body.actions = Actions.pushAction(transferrer.body.actions, [
			...recipient.toFields(),
			...amount.toFields(),
			...timeout.toFields(),
			...holderAccountL1.toFields(),
			...runtime.outerPk.toFields()
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

		const feePayout = AccountUpdate.create(runtime.bridgeFeeRecipientL1)
		feePayout.balance.addInPlace(runtime.bridgeProofFee)
		feePayout.body.useFullCommitment = Bool(true)
		feePayout.body.implicitAccountCreationFee = Bool(true)
		feePayout.body.mayUseToken = {
			parentsOwnToken: Bool(true),
			inheritFromParent: Bool(false)
		}

		const childrenHash = AccountUpdateForest.fromFlatArray([receiver, feePayout]).hash

		const actionWitness = AccountUpdate.create(runtime.outerPk)
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
			verificationKeyHash: await getVkHash(runtime.outerPk)
		}

		AccountUpdate.attachToTransaction(actionWitness)
	})

	const signed = await signTxn(txn)

	const transferrer = signed.transaction.accountUpdates.find(({ publicKey }) =>
		publicKey.equals(recipient).toBoolean()
	)
	if (!transferrer) throw new Error("Transferrer not found")

	const { data } = await runtime.l2Client().mutation(submitDepositMutation, {
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

	return await pollProvingResult(runtime, data.request.key)
}

export async function fetchDepositFinalizationWitnesses(
	runtime: BridgeRuntime,
	pk: PublicKey
): Promise<
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
	setL2(runtime)

	const context = await fetchDepositStateContext(runtime, pk)

	if (context.depositsByAux.size === 0) {
		return { ok: false, msg: "No deposits found" }
	}

	if (context.depositWitnesses.length === 0) {
		return { ok: false, msg: "No deposit witnesses found" }
	}

	const minDepositIndex = context.prevNextDeposit

	for (const witness of getSortedDepositWitnesses(context)) {
		if (
			isDepositCancelled(context, witness) ||
			isDepositFinalised(context, witness) ||
			minDepositIndex.greaterThan(UInt32.from(witness.index)).toBoolean()
		) {
			continue
		}

		if (buildDepositCancellationWitnessInput(context, witness) !== null) {
			continue
		}

		const finalizationWitness = buildDepositFinalizationWitnessValue(context, witness)
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

export async function finalizeDeposit(
	runtime: BridgeRuntime,
	pk: PublicKey,
	signTxn: SignTransaction,
	options?: number | RetryableTransactionOptions
): Promise<string> {
	const { attempts, fee } = normalizeRetryableTransactionOptions(options)
	const prove = async (attempts: number) => {
		if (attempts === 0) throw new Error("Failed to prove deposit finalization")

		const witnesses = await fetchDepositFinalizationWitnesses(runtime, pk)

		if (!witnesses.ok) throw new Error(witnesses.msg)

		const { witness, depositParams, aseTarget } = witnesses.value

		setL2(runtime)
		await refreshCache(depositParams.deposit.recipient)
		await refreshCache(depositParams.deposit.recipient, TokenId.derive(runtime.innerHolder))
		await refreshCache(runtime.innerHolder)

		let isHelperAccountNew = false
		const txn = await Mina.transaction(
			{
				sender: runtime.sequencerPk,
				fee
			},
			async () => {
				const helperAccount = AccountUpdate.createSigned(
					depositParams.deposit.recipient,
					TokenId.derive(runtime.innerHolder)
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
					value: Field(witness.prevNextDeposit)
				}
				helperAccount.account.nonce.getAndRequireEquals()

				const innerWitness = AccountUpdate.create(runtime.innerPk)
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
				payout = payout.sub(runtime.bridgeProofFee)
				if (isHelperAccountNew) payout = payout.sub(runtime.l2AccountCreationFee)
				recipientPayout.balance.addInPlace(payout)

				const feePayout = AccountUpdate.create(runtime.bridgeFeeRecipientL2)
				feePayout.body.useFullCommitment = Bool(true)
				feePayout.body.implicitAccountCreationFee = Bool(true)
				feePayout.body.mayUseToken = {
					parentsOwnToken: Bool(true),
					inheritFromParent: Bool(false)
				}
				feePayout.balance.addInPlace(runtime.bridgeProofFee)

				const finalizeDeposit = AccountUpdate.create(runtime.innerHolder)
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
					verificationKeyHash: await getVkHash(runtime.innerHolder)
				}
				AccountUpdate.attachToTransaction(finalizeDeposit)
			}
		)

		const signed = await signTxn(txn)
		const helperAccountUpdate = signed.transaction.accountUpdates.find(
			({ publicKey, tokenId }) =>
				publicKey.equals(depositParams.deposit.recipient).toBoolean() &&
				tokenId.equals(TokenId.derive(runtime.innerHolder)).toBoolean()
		)
		if (!helperAccountUpdate) throw new Error("Helper account update not found")

		const helperAccountNonce =
			helperAccountUpdate.body.preconditions.account.nonce.value.lower.toString()

		const helperAccountSignatureString = helperAccountUpdate.authorization.signature
		if (!helperAccountSignatureString) throw new Error("Helper account update not signed")
		const helperAccountSignature = Signature.fromBase58(helperAccountSignatureString)

		const { data, error } = await runtime.l2Client().mutation(finalizeDepositMutation, {
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
		const txnHash = await pollProvingResult(runtime, data.request.key)

		const currentSyncedOuterActionState = await fetchSyncedOuterActionState(runtime)

		if (currentSyncedOuterActionState.state.equals(aseTarget.state).toBoolean()) {
			return txnHash
		}
		return await prove(attempts - 1)
	}

	return await prove(attempts)
}

export async function canFinalizeDeposit(
	runtime: BridgeRuntime,
	pk: PublicKey
): Promise<{ available: boolean; reason: string | null }> {
	debug(runtime, "canFinalizeDeposit start", { pk: pk.toBase58() })
	const result = await fetchDepositFinalizationWitnesses(runtime, pk)
	debug(runtime, "canFinalizeDeposit result", result)
	return {
		available: result.ok,
		reason: result.ok ? null : result.msg
	}
}

function buildDepositFinalizationWitnessValue(
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
	const depositParams = getDepositParamsForWitness(context, witness)
	const minDepositIndex = context.prevNextDeposit

	if (isDepositCancelled(context, witness) || isDepositFinalised(context, witness)) {
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
			action.synchronizedOuterActionStateLength.greaterThan(UInt32.from(witness.index)).toBoolean()
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

function buildDepositWithState(
	context: DepositStateContext,
	witness: OuterWitness
): DepositWithState {
	const depositParams = getDepositParamsForWitness(context, witness)
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

	const cancelled = isRejected && isDepositCancelled(context, witness)
	const synced = context.syncedOuterActionState.length
		.greaterThanOrEqual(UInt32.from(witness.index + 1))
		.toBoolean()
	const accepted = context.lastCommit.index >= witness.index
	const confirmed = context.lastCommit.synchronizedOuterActionStateLength
		.greaterThanOrEqual(UInt32.from(witness.index + 1))
		.toBoolean()
	const finalised = isAccepted && isDepositFinalised(context, witness)

	return {
		...witness,
		...depositParams.deposit,
		cancelled,
		synced,
		accepted,
		confirmed,
		finalised,
		cancellable: buildDepositCancellationWitnessInput(context, witness) !== null
	}
}

export async function fetchDepositsWithStates(
	runtime: BridgeRuntime,
	pk: PublicKey
): Promise<{
	deposits: DepositWithState[]
	syncedIndex: number
	acceptedIndex: number
	confirmedIndex: number
	finalisedIndex: number
	cancelledIndex: number
}> {
	const context = await fetchDepositStateContext(runtime, pk)

	return {
		deposits: getSortedDepositWitnesses(context).map((witness) =>
			buildDepositWithState(context, witness)
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
