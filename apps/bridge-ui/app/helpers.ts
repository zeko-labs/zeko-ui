import { createToaster } from "@ark-ui/vue/toast"
import type { Entries } from "type-fest"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

export const depositSteps = [
	"Submit Deposit",
	"Confirm Deposit",
	"Finalize Deposit",
	"Deposit Completed"
] as const

export const withdrawalSteps = [
	"Submit Withdrawal",
	"Confirm Withdrawal",
	"Finalize Withdrawal",
	"Withdrawal Completed"
] as const

export const steps = ["Send", "Confirming", "Claim", "Finalizing"] as const

type Direction = "deposit" | "withdrawal"

type MachineStates = ReturnType<(typeof bridgeOperationMachine)["getInitialSnapshot"]>["value"]

const deposit = (kind: "pending" | "complete") => (step: number) => ({
	text: depositSteps[step] as (typeof depositSteps)[number],
	kind
})
const withdrawal = (kind: "pending" | "complete") => (step: number) => ({
	text: withdrawalSteps[step] as (typeof withdrawalSteps)[number],
	kind
})
const pendingDeposit = deposit("pending")
const pendingWithdrawal = withdrawal("pending")

export const statePath = (state: MachineStates) => {
	if (typeof state === "string") return `bridgeOperation.${state}` as const
	const [path] = (Object.entries(state) as Entries<typeof state>).map(
		([k, v]) => `bridgeOperation.${k}.${v}` as const
	)
	if (!path) throw new Error(`Invalid state path for state: ${JSON.stringify(state)}`)
	return path
}

export const statusFromState = (
	state: MachineStates,
	direction: Direction
): { text: string; kind: "pending" | "complete" | "cancelled" | "error" } => {
	const isDeposit = direction === "deposit"
	if (typeof state === "string") {
		if (state === "BRIDGE_OPERATION_CANCELLED_DONE" || state === "DEPOSIT_CANCELLED")
			return { text: "Cancelled", kind: "cancelled" }
		if (state.includes("DONE") || state === "BRIDGE_OPERATION_COMPLETED")
			return isDeposit ? deposit("complete")(3) : withdrawal("complete")(3)
		if (state === "PENDING_DEPOSIT") return pendingDeposit(1)
		if (state === "PENDING_WITHDRAWAL") return pendingWithdrawal(1)
		if (state === "TO_FINALIZE") return isDeposit ? pendingDeposit(2) : pendingWithdrawal(2)
		if (state === "CAN_CANCEL") return { text: "Failed", kind: "error" }
		if (state === "PAUSED") return { text: "Paused", kind: "pending" }
		if (state === "IDLE") return { text: "Idle", kind: "pending" }
		if (state === "FAILED") return { text: "Failed", kind: "error" }
		if (state === "WAITING_FOR_NETWORK") return { text: "Waiting for network", kind: "pending" }
	}
	if (typeof state === "object") {
		if ("SUBMIT_DEPOSIT" in state) return pendingDeposit(0)
		if ("SUBMIT_WITHDRAWAL" in state) return pendingWithdrawal(0)
		if ("FINALIZE_DEPOSIT" in state) return pendingDeposit(2)
		if ("FINALIZE_WITHDRAWAL" in state) return pendingWithdrawal(2)
		if ("CANCEL_DEPOSIT" in state) return { text: "Cancelling", kind: "pending" }
	}
	return isDeposit ? pendingDeposit(1) : pendingWithdrawal(1)
}

export const errorToaster = createToaster({
	placement: "top-end",
	overlap: true,
	gap: 24
})

const submit = "Zeko Bridge is generating a transaction to sign with your wallet."
export const bridgeMessages = {
	submit,
	submitDeposit: "Waiting for the transaction to be confirmed.",
	submitWithdrawal: submit,
	pending:
		"Your Send Transaction is awaiting on-chain Confirmation. This can take 1 hour or more, to ensure Mina L1 finality. You can leave this page and return later to Claim your bridge transaction.",
	initBridgeOperation:
		"Please wait… the Zeko Bridge is loading your wallet's latest transaction history and status.",
	toFinalize:
		"Claim generates a zero-knowledge proof to sign with your wallet on the destination chain.",
	finalizeTransaction: "Zeko Bridge is generating a sequencer proof to sign with your wallet.",
	finalizeDeposit:
		"Your Bridge Transaction is Claimed. The status is still Pending until it's finalized on Zeko. This typically takes a few seconds. Completed Transactions appear below.",
	finalizeWithdrawal:
		"Your Bridge Transaction is Claimed. The status is still Pending until it's finalized on Mina. This can take up to 1 hour, to ensure Mina L1 finality. Completed Transactions appear below.",
	canCancel:
		"Your Send Transaction took longer than the Bridge Timeout setting, <b>please Cancel to reclaim your funds</b> on Mina L1, and try Bridging again.",
	cancelDeposit: "Waiting for the cancellation transaction to be confirmed.",
	cancellingDeposit:
		"Zeko Bridge is generating a cancellation transaction to sign with your wallet.",
	depositCancelled:
		"Your deposit has been cancelled. Your funds have been returned to your wallet on Mina L1."
} as const
