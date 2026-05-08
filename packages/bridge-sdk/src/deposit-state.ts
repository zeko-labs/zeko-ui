import { Field, PublicKey, TokenId, UInt32, UInt64 } from "o1js"
import { fromList } from "./actions"
import { fetchAccount, fetchCurrentSlot } from "./network"
import type { BridgeRuntime } from "./runtime"
import type { Account, Deposit, OuterAction, OuterCommit, OuterWitness } from "./types"
import {
	BRIDGE_DEPLOY_BLOCK,
	depositAux,
	fetchActions,
	fetchCommitAsePastSlot,
	fetchOuterActionsFromIndexer,
	fetchOuterWitnessesFromAuxes,
	filterNulls,
	getNextCancelledDepositIndex,
	getNextDepositIndex
} from "./utils"

export type DepositParams = {
	deposit: Deposit
	aux: Field
}

export type DepositStateContext = {
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
	commitAseTarget: Field
	synchronizedOuterActionStateIndex: number
	currentSyncedOuterActionStateIndex: number
	depositWitnesses: OuterWitness[]
	depositsByAux: Map<bigint, DepositParams>
	outerActions: OuterAction[]
}

export async function fetchUserDeposits(runtime: BridgeRuntime, pk: PublicKey): Promise<Deposit[]> {
	const userOuterActions = await fetchActions(runtime.l1ArchiveClient, pk, BRIDGE_DEPLOY_BLOCK)

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

			if (!outerPk.equals(runtime.outerPk).toBoolean()) return null

			if (!runtime.outerHolders.some((holder) => holder.equals(holderAccountL1).toBoolean()))
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

export async function fetchSyncedOuterActionState(
	runtime: BridgeRuntime
): Promise<{ state: Field; length: UInt32 }> {
	const innerAccount = await (runtime.bridge?.fetchAccount ?? fetchAccount)(
		runtime.l2Client,
		runtime.innerPk
	)

	if (!innerAccount || !innerAccount.zkappState) throw new Error("Inner account not found")
	const [state, length] = innerAccount.zkappState
	return {
		state: Field.from(state),
		length: UInt32.from(length)
	}
}

export async function fetchDepositStateContext(
	runtime: BridgeRuntime,
	pk: PublicKey
): Promise<DepositStateContext> {
	const deposits = (
		await (runtime.bridge?.fetchUserDeposits?.(pk) ?? fetchUserDeposits(runtime, pk))
	).map((deposit) => ({
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
					runtime.actionsApiClient,
					deposits.map(({ aux }) => aux.toString())
				)

	const [helperAccountL1, helperAccountL2, syncedOuterActionState, currentSlot] = await Promise.all(
		[
			(runtime.bridge?.fetchAccount ?? fetchAccount)(
				runtime.l1Client,
				pk,
				TokenId.derive(runtime.outerTokenOwner)
			),
			(runtime.bridge?.fetchAccount ?? fetchAccount)(
				runtime.l2Client,
				pk,
				TokenId.derive(runtime.innerHolder)
			),
			runtime.bridge?.fetchSyncedOuterActionState?.() ?? fetchSyncedOuterActionState(runtime),
			runtime.bridge?.fetchCurrentSlot?.() ?? fetchCurrentSlot(runtime)
		]
	)

	const prevNextCancelledDeposit = helperAccountL1
		? getNextCancelledDepositIndex(helperAccountL1)
		: UInt32.zero
	const prevNextDeposit = helperAccountL2 ? getNextDepositIndex(helperAccountL2) : UInt32.zero

	const { commit: lastCommit, ase } = await fetchCommitAsePastSlot(
		runtime.actionsApiClient,
		+currentSlot.sub(runtime.withdrawalDelay)
	)

	const earliestBeforeState =
		depositWitnesses.length === 0
			? null
			: [...depositWitnesses].sort((a, b) => a.index - b.index).at(0)?.beforeActionState ?? null

	const outerActions =
		earliestBeforeState === null
			? []
			: await fetchOuterActionsFromIndexer(runtime.actionsApiClient, {
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
		commitAseTarget: ase.at(-1)?.afterActionState ?? lastCommit.afterActionState,
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

export function getSortedDepositWitnesses(context: DepositStateContext): OuterWitness[] {
	return [...context.depositWitnesses].sort((left, right) => left.index - right.index)
}

export function getDepositParamsForWitness(
	context: DepositStateContext,
	witness: OuterWitness
): DepositParams {
	const depositParams = context.depositsByAux.get(witness.aux.toBigInt())
	if (!depositParams) throw new Error("Unreachable: Did not find deposit")
	return depositParams
}

export function isDepositCancelled(context: DepositStateContext, witness: OuterWitness): boolean {
	return context.prevNextCancelledDeposit.greaterThan(UInt32.from(witness.index)).toBoolean()
}

export function isDepositFinalised(context: DepositStateContext, witness: OuterWitness): boolean {
	return context.prevNextDeposit.greaterThanOrEqual(UInt32.from(witness.index + 1)).toBoolean()
}
