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

export const statusFromState = (
	state: MachineStates,
	direction: Direction
): { text: string; kind: "pending" | "complete" } => {
	const isDeposit = direction === "deposit"
	switch (state) {
		case "BRIDGE_OPERATION_DONE":
		case "BRIDGE_OPERATION_DONE_NOOP":
			return isDeposit ? deposit("complete")(3) : withdrawal("complete")(3)
		case "SUBMIT_DEPOSIT":
			return pendingDeposit(0)
		case "PENDING_DEPOSIT":
			return pendingDeposit(1)
		case "FINALIZE_DEPOSIT":
			return pendingDeposit(2)
		case "SUBMIT_WITHDRAWAL":
			return pendingWithdrawal(0)
		case "PENDING_WITHDRAWAL":
			return pendingWithdrawal(1)
		case "FINALIZE_WITHDRAWAL":
			return pendingWithdrawal(2)
		case "TO_FINALIZE":
			return isDeposit ? pendingDeposit(2) : pendingWithdrawal(2)
		case "PAUSED":
			return { text: "Paused", kind: "pending" }
		case "IDLE":
			return { text: "Idle", kind: "pending" }
		default:
			return isDeposit ? pendingDeposit(1) : pendingWithdrawal(1)
	}
}
