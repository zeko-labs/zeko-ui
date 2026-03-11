import type { OperationPhase, OperationSession, OperationStatus } from "./types"
import { color, icon, keyValue, section } from "./terminal"

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
		`${session.status === "completed" ? icon.success() : icon.error()} ${section(
			`Bridge ${session.status}`
		)}`,
		keyValue("Operation", session.id),
		keyValue("Route", session.route),
		keyValue("Phase", session.phase),
		keyValue("Recipient", session.recipient ?? session.account),
		keyValue("Amount", session.amount),
		keyValue("Log", session.logPath),
		session.finalTransaction ? keyValue("Final hash", session.finalTransaction.hash) : ""
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
		.map(([key, value]) => `${color.gray(`${key}=`)}${String(value)}`)
		.join(` ${icon.bullet()} `)

	const eventIcon =
		event === "failed"
			? icon.error()
			: event === "completed" || event === "finalized" || event === "submitted"
				? icon.success()
				: event === "heartbeat" || event.startsWith("waiting-")
					? icon.waiting()
					: icon.info()

	return [
		color.dim(`[${new Date().toISOString()}]`),
		eventIcon,
		color.bold(event),
		color.gray(`phase=${phase}`),
		suffix
	]
		.filter(Boolean)
		.join(" ")
}
