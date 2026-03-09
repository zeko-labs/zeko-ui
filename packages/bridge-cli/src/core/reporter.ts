import type { OperationPhase, OperationSession, OperationStatus } from "./types"

export type BridgeCommandJsonResult = {
	success: boolean
	operation_id: string
	route: OperationSession["route"]
	direction: OperationSession["direction"]
	status: OperationStatus
	amount: string
	recipient: string
	submitted_transactions: OperationSession["submittedTransactions"]
	final_transaction: OperationSession["finalTransaction"] | null
	explorer_urls: string[]
	log_path: string
}

export const toBridgeJsonResult = (session: OperationSession): BridgeCommandJsonResult => ({
	success: session.status === "completed",
	operation_id: session.id,
	route: session.route,
	direction: session.direction,
	status: session.status,
	amount: session.amount,
	recipient: session.recipient ?? session.account,
	submitted_transactions: session.submittedTransactions,
	final_transaction: session.finalTransaction ?? null,
	explorer_urls: session.finalTransaction?.explorerUrl
		? [session.finalTransaction.explorerUrl]
		: [],
	log_path: session.logPath
})

export const renderBridgeResult = (session: OperationSession): string =>
	[
		`bridge ${session.status}`,
		`Operation: ${session.id}`,
		`Route: ${session.route}`,
		`Phase: ${session.phase}`,
		`Recipient: ${session.recipient ?? session.account}`,
		`Amount: ${session.amount}`,
		`Log: ${session.logPath}`,
		session.finalTransaction ? `Final hash: ${session.finalTransaction.hash}` : ""
	]
		.filter(Boolean)
		.join("\n")

export const renderOperationProgress = ({
	event,
	phase,
	details
}: {
	event: string
	phase: OperationPhase
	details?: Record<string, unknown>
}): string => {
	const suffix = Object.entries(details ?? {})
		.filter(([, value]) => value !== undefined && value !== null && value !== "")
		.map(([key, value]) => `${key}=${String(value)}`)
		.join(" ")

	return [`[${new Date().toISOString()}]`, event, `phase=${phase}`, suffix]
		.filter(Boolean)
		.join(" ")
}
