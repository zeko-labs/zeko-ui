export const WORKFLOW_HARD_TIMEOUT_MS = 2 * 60 * 60 * 1000
export const BRIDGE_COMMAND_INITIAL_POLL_INTERVAL_MS = 30 * 1000
export const BRIDGE_COMMAND_POLL_INTERVAL_MS = 10 * 60 * 1000

export const getRemainingWorkflowTimeMs = ({
	startedAtMs,
	nowMs
}: {
	startedAtMs: number
	nowMs: number
}) => Math.max(0, WORKFLOW_HARD_TIMEOUT_MS - Math.max(0, nowMs - startedAtMs))
