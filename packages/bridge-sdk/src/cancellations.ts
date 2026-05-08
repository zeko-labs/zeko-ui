import { cancelDepositMutation } from "@zeko-labs/graphql"
import {
	AccountUpdate,
	Bool,
	Field,
	Mina,
	Provable,
	type PublicKey,
	Signature,
	TokenId,
	UInt32
} from "o1js"
import { fromList } from "./actions"
import {
	fetchDepositStateContext,
	getDepositParamsForWitness,
	getSortedDepositWitnesses,
	isDepositCancelled,
	isDepositFinalised,
	type DepositStateContext
} from "./deposit-state"
import { setL1 } from "./network"
import { pollProvingResult } from "./prover"
import { debug, type BridgeRuntime } from "./runtime"
import {
	normalizeRetryableTransactionOptions,
	type RetryableTransactionOptions,
	type SignTransaction
} from "./transactions"
import type { Account, Deposit, ExtractInput, OuterWitness, WitnessFetchResult } from "./types"
import { checkAccepted, getVkHash, refreshCache } from "./utils"

export function buildDepositCancellationWitnessInput(
	context: DepositStateContext,
	witness: OuterWitness
): Omit<ExtractInput<typeof cancelDepositMutation>, "publicKey"> | null {
	const depositParams = getDepositParamsForWitness(context, witness)

	const { isRejected, isAccepted } = checkAccepted(
		context.outerActions,
		UInt32.from(witness.index),
		depositParams.deposit
	)

	const cancelled = isRejected && isDepositCancelled(context, witness)
	const finalised = isAccepted && isDepositFinalised(context, witness)

	if (cancelled || finalised) return null

	const minDepositIndex = context.prevNextCancelledDeposit

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

export async function fetchDepositCancellationWitnesses(
	runtime: BridgeRuntime,
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
	const context = await fetchDepositStateContext(runtime, pk)

	if (context.depositsByAux.size === 0) {
		return { ok: false, msg: "No deposits found" }
	}

	if (context.depositWitnesses.length === 0) {
		return { ok: false, msg: "No deposit witnesses found" }
	}

	const sortedWitnesses = getSortedDepositWitnesses(context)

	for (const witness of sortedWitnesses) {
		const depositParams = getDepositParamsForWitness(context, witness)

		const witnessInput = buildDepositCancellationWitnessInput(context, witness)
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

export async function cancelDeposit(
	runtime: BridgeRuntime,
	pk: PublicKey,
	signTxn: SignTransaction,
	_outerHolder?: PublicKey,
	options?: RetryableTransactionOptions
): Promise<string> {
	const { fee } = normalizeRetryableTransactionOptions(options)
	debug(runtime, "cancelDeposit start", { pk: pk.toBase58() })
	const outerHolder = _outerHolder ?? runtime.outerHolders[0]
	const witnesses = await fetchDepositCancellationWitnesses(runtime, pk, outerHolder)
	debug(runtime, "cancelDeposit witnesses", witnesses)

	if (!witnesses.ok) throw new Error("Did not find deposit to cancel")

	const { witness, depositParams, commitAseTarget } = witnesses.value

	setL1(runtime)
	await refreshCache(depositParams.deposit.recipient)
	await refreshCache(depositParams.deposit.recipient, TokenId.derive(runtime.outerTokenOwner))
	await refreshCache(runtime.outerTokenOwner)
	await refreshCache(outerHolder)

	let isHelperAccountNew = false
	const txn = await Mina.transaction(
		{
			sender: runtime.sequencerPk,
			fee
		},
		async () => {
			const helperAccount = AccountUpdate.createSigned(
				depositParams.deposit.recipient,
				TokenId.derive(runtime.outerTokenOwner)
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

			const tokenOwner = AccountUpdate.create(runtime.outerTokenOwner)
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
				verificationKeyHash: await getVkHash(runtime.outerTokenOwner)
			}

			const outerWitness = AccountUpdate.create(runtime.outerPk)
			outerWitness.body.useFullCommitment = Bool(true)
			outerWitness.body.implicitAccountCreationFee = Bool(true)
			outerWitness.body.mayUseToken = {
				parentsOwnToken: Bool(false),
				inheritFromParent: Bool(false)
			}
			outerWitness.body.preconditions.account.state[1] = {
				isSome: Bool(true),
				value: Field(0)
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
			payout = payout.sub(runtime.bridgeProofFee)
			if (isHelperAccountNew) payout = payout.sub(runtime.l1AccountCreationFee)
			recipientPayout.balance.addInPlace(payout)

			const feePayout = AccountUpdate.create(runtime.bridgeFeeRecipientL1)
			feePayout.body.useFullCommitment = Bool(true)
			feePayout.body.implicitAccountCreationFee = Bool(true)
			feePayout.body.mayUseToken = {
				parentsOwnToken: Bool(true),
				inheritFromParent: Bool(false)
			}
			feePayout.balance.addInPlace(runtime.bridgeProofFee)

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
			tokenId.equals(TokenId.derive(runtime.outerTokenOwner)).toBoolean()
	)
	if (!helperAccountUpdate) throw new Error("Helper account update not found")

	const helperAccountNonce =
		helperAccountUpdate.body.preconditions.account.nonce.value.lower.toString()

	const helperAccountSignatureString = helperAccountUpdate.authorization.signature
	if (!helperAccountSignatureString) throw new Error("Helper account update not signed")
	const helperAccountSignature = Signature.fromBase58(helperAccountSignatureString)

	const { data, error } = await runtime.l2Client().mutation(cancelDepositMutation, {
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
	debug(runtime, "cancelDeposit mutation key", { key: data.request.key })

	return await pollProvingResult(runtime, data.request.key)
}

export async function canCancelDeposit(
	runtime: BridgeRuntime,
	pk: PublicKey
): Promise<{ available: boolean; reason: string | null }> {
	const context = await fetchDepositStateContext(runtime, pk)
	const available = getSortedDepositWitnesses(context).some(
		(witness) => buildDepositCancellationWitnessInput(context, witness) !== null
	)
	debug(runtime, "canCancelDeposit result", {
		pk: pk.toBase58(),
		available,
		depositCount: context.depositWitnesses.length
	})
	return {
		available,
		reason: available ? null : "No cancellable deposit found"
	}
}
