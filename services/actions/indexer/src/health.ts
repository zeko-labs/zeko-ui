export interface DatabaseHealthSnapshot {
	healthy: boolean
	latency: number
	error?: string
	checkedAt: number | null
}

export interface IndexerStatusSnapshot {
	isRunning: boolean
	lastFetchedBlock: { outer: number | null; inner: number | null }
	consecutiveErrors: number
}

export interface HealthComputationInput {
	now: number
	dbHealth: DatabaseHealthSnapshot
	indexerStatus: IndexerStatusSnapshot
	staleAfterMs: number
	environment?: string
}

export interface HealthComputationResult {
	httpStatus: 200 | 503
	response: {
		status: "healthy" | "degraded" | "unhealthy"
		timestamp: string
		service: {
			name: string
			environment: string
		}
		database: {
			status: "up" | "down" | "unknown"
			latency_ms: number
			checkedAt: string | null
			ageMs: number | null
			error?: string
		}
		indexer: {
			status: "running" | "stopped"
			lastFetchedBlock: { outer: number | null; inner: number | null }
			consecutiveErrors: number
		}
	}
}

const MIN_CONSECUTIVE_ERRORS = 5

export function computeHealthStatus({
	now,
	dbHealth,
	indexerStatus,
	staleAfterMs,
	environment
}: HealthComputationInput): HealthComputationResult {
	const ageMs = dbHealth.checkedAt == null ? null : Math.max(0, now - dbHealth.checkedAt)
	const isDbStale = ageMs == null || ageMs > staleAfterMs
	const isIndexerHealthy =
		indexerStatus.isRunning && indexerStatus.consecutiveErrors < MIN_CONSECUTIVE_ERRORS
	const isFreshDbFailure = !isDbStale && !dbHealth.healthy

	const isHealthy = isIndexerHealthy && !isFreshDbFailure
	const status: "healthy" | "degraded" | "unhealthy" = !isIndexerHealthy
		? "unhealthy"
		: isFreshDbFailure
			? "degraded"
			: "healthy"

	const dbStatus: "up" | "down" | "unknown" = isFreshDbFailure
		? "down"
		: dbHealth.healthy
			? "up"
			: "unknown"

	return {
		httpStatus: isHealthy ? 200 : 503,
		response: {
			status,
			timestamp: new Date(now).toISOString(),
			service: {
				name: "actions-indexer",
				environment: environment ?? "unknown"
			},
			database: {
				status: dbStatus,
				latency_ms: Math.round(dbHealth.latency),
				checkedAt: dbHealth.checkedAt == null ? null : new Date(dbHealth.checkedAt).toISOString(),
				ageMs,
				...(dbHealth.error && { error: dbHealth.error })
			},
			indexer: {
				status: indexerStatus.isRunning ? "running" : "stopped",
				lastFetchedBlock: indexerStatus.lastFetchedBlock,
				consecutiveErrors: indexerStatus.consecutiveErrors
			}
		}
	}
}

export function createDatabaseHealthMonitor({
	refreshIntervalMs,
	check
}: {
	refreshIntervalMs: number
	check: () => Promise<{ healthy: boolean; latency: number; error?: string }>
}) {
	let snapshot: DatabaseHealthSnapshot = {
		healthy: false,
		latency: 0,
		error: "health check pending",
		checkedAt: null
	}
	let timer: ReturnType<typeof setInterval> | null = null

	const refresh = async () => {
		const result = await check()
		snapshot = {
			...result,
			checkedAt: Date.now()
		}
	}

	return {
		start() {
			if (timer != null) return
			void refresh()
			timer = setInterval(() => {
				void refresh()
			}, refreshIntervalMs)
			timer.unref?.()
		},
		stop() {
			if (timer == null) return
			clearInterval(timer)
			timer = null
		},
		getSnapshot() {
			return { ...snapshot }
		}
	}
}
