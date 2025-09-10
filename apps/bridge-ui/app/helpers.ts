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
): { text: string; kind: "pending" | "complete" | "error" } => {
	const isDeposit = direction === "deposit"
	if (typeof state === "string") {
		if (state.includes("DONE") || state === "BRIDGE_OPERATION_COMPLETED")
			return isDeposit ? deposit("complete")(3) : withdrawal("complete")(3)
		if (state === "PENDING_DEPOSIT") return pendingDeposit(1)
		if (state === "PENDING_WITHDRAWAL") return pendingWithdrawal(1)
		if (state === "TO_FINALIZE") return isDeposit ? pendingDeposit(2) : pendingWithdrawal(2)
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
	}
	return isDeposit ? pendingDeposit(1) : pendingWithdrawal(1)
}

export const errorToaster = createToaster({
	placement: "bottom-end",
	overlap: true,
	gap: 24
})
