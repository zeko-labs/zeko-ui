import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { getSubmitHash } from "./decisions"
import type { ChainRef, LogFn, OperationPhase, OperationSession } from "./types"
import { parseRouteString } from "./routes"

export type SessionStore = ReturnType<typeof createSessionStore>

export const createSessionStore = ({ stateDir }: { stateDir: string }) => {
	const operationsDir = path.join(stateDir, "operations")
	const filePath = (id: string) => path.join(operationsDir, `${id}.json`)
	const ensureDir = () => mkdir(operationsDir, { recursive: true })
	return {
		async save(session: OperationSession): Promise<void> {
			await ensureDir()
			await writeFile(filePath(session.id), JSON.stringify(session, null, 2))
		},
		async load(id: string): Promise<OperationSession | null> {
			try {
				return JSON.parse(await readFile(filePath(id), "utf8")) as OperationSession
			} catch (error) {
				if (error instanceof Error && "code" in error && error.code === "ENOENT") return null
				throw error
			}
		},
		async list(): Promise<OperationSession[]> {
			await ensureDir()
			const files = (await readdir(operationsDir)).filter((file) => file.endsWith(".json"))
			const sessions = await Promise.all(
				files.map(
					async (file) =>
						JSON.parse(await readFile(path.join(operationsDir, file), "utf8")) as OperationSession
				)
			)
			return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
		}
	}
}

export const createOperationLogger = ({ logPath }: { logPath: string }) => ({
	async write(event: string, payload: Record<string, unknown> = {}): Promise<void> {
		await mkdir(path.dirname(logPath), { recursive: true })
		await appendFile(
			logPath,
			`${JSON.stringify({ timestamp: new Date().toISOString(), event, ...payload })}\n`
		)
	}
})

export const renderOperationProgress = ({
	event,
	phase,
	details
}: {
	event: string
	phase: OperationPhase
	details?: Record<string, unknown>
}): string => {
	const suffix = details ? ` ${JSON.stringify(details)}` : ""
	return `[${phase}] ${event}${suffix}`
}

export const toBridgeJsonResult = (session: OperationSession) => ({
	success: session.status === "completed" || session.status === "cancelled",
	id: session.id,
	status: session.status,
	phase: session.phase,
	route: session.route,
	direction: session.direction,
	account: session.account,
	recipient: session.recipient ?? session.account,
	amount: session.amount,
	timeout_slots: session.timeoutSlots,
	target_index: session.targetIndex,
	log_path: session.logPath,
	submitted_transactions: session.submittedTransactions,
	final_transaction: session.finalTransaction,
	error: session.lastError ?? null,
	created_at: session.createdAt,
	updated_at: session.updatedAt,
	verbose_diagnostics: session.verboseDiagnostics
})

export const renderBridgeResult = (session: OperationSession): string =>
	[
		`${session.status === "completed" || session.status === "cancelled" ? "Success" : "Failed"}: ${session.direction} ${session.amount} ${session.route}`,
		`Operation: ${session.id}`,
		`Status: ${session.status}`,
		`Phase: ${session.phase}`,
		`Account: ${session.account}`,
		`Recipient: ${session.recipient ?? session.account}`,
		`Submit: ${getSubmitHash(session) ?? "-"}`,
		`Final: ${session.finalTransaction?.hash ?? "-"}`,
		`Log: ${session.logPath}`,
		...(session.lastError ? [`Error: ${session.lastError}`] : [])
	].join("\n")

export const createProgressLog =
	({
		writeProgress,
		logger
	}: {
		writeProgress: (message: string) => void
		logger?: Pick<ReturnType<typeof createOperationLogger>, "write">
	}): LogFn =>
	async ({ event, phase, details }) => {
		writeProgress(renderOperationProgress({ event, phase, details }))
		await logger?.write(event, { phase, ...details })
	}

export const parseSessionRoute = (session: OperationSession): [ChainRef, ChainRef] =>
	parseRouteString(session.route)

export const projectOperationStatus = (session: OperationSession) => {
	const snapshot = session.liveSnapshot
	const displayPhase =
		session.status === "completed" || session.status === "cancelled" || session.status === "failed"
			? session.phase
			: snapshot?.nextAction === "finalize"
				? "ready-finalization"
				: snapshot?.nextAction === "cancel"
					? "ready-cancellation"
					: session.phase
	return {
		id: session.id,
		status: session.status,
		phase: displayPhase,
		route: session.route,
		direction: session.direction,
		account: session.account,
		recipient: session.recipient ?? session.account,
		amount: session.amount,
		log_path: session.logPath,
		refreshed_at: snapshot?.refreshedAt ?? session.updatedAt,
		target_index: snapshot?.targetIndex ?? session.targetIndex ?? null,
		claimable_index: snapshot?.claimableIndex ?? null,
		pending_ahead: snapshot?.pendingAhead ?? null,
		can_finalize: snapshot?.canFinalize ?? null,
		can_cancel: snapshot?.canCancel ?? null,
		submit_hash: snapshot?.submitHash ?? getSubmitHash(session) ?? null,
		next_action: snapshot?.nextAction ?? null,
		waiting_on: snapshot?.waitingOn ?? null,
		error: session.lastError ?? null,
		verbose_diagnostics: session.verboseDiagnostics
	}
}
