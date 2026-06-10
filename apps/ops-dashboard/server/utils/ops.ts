export type ServiceKind = "actions-indexer" | "archive" | "daemon"
export type ServiceStatus = "ok" | "warn" | "error" | "unknown"

export interface OpsEndpointConfig {
	actionsIndexerUrl: string
	l1ArchiveUrl: string
	l2ArchiveUrl: string
	l1DaemonUrl: string
	l2DaemonUrl: string
}

export interface ServiceProbe {
	id: string
	label: string
	kind: ServiceKind
	status: ServiceStatus
	endpoint: string
	checkedAt: string
	latencyMs: number | null
	httpStatus: number | null
	details: Record<string, string | number | boolean | null>
	error?: string
}

export interface OpsSnapshot {
	checkedAt: string
	config: OpsEndpointConfig
	summary: Record<ServiceStatus, number>
	services: ServiceProbe[]
}

export type ControlAction = "start" | "stop" | "rebuild" | "reset"

const requestTimeoutMs = 12_000

const mainnetDefaults: OpsEndpointConfig = {
	actionsIndexerUrl: "https://indexer.actions.zeko.io",
	l1ArchiveUrl: "https://gateway.mina.archive.mainnet.zeko.io",
	l2ArchiveUrl: "https://archive.mainnet.zeko.io/graphql",
	l1DaemonUrl: "https://gateway.mina.mainnet.zeko.io",
	l2DaemonUrl: "https://mainnet.zeko.io/graphql"
}

const readEnv = (key: string): string | undefined => {
	const value = process.env[key]?.trim()
	return value ? value : undefined
}

export const normalizeEndpoint = (url: string): string => url.replace(/\/+$/, "")

export const getOpsConfig = (): OpsEndpointConfig => ({
	actionsIndexerUrl: normalizeEndpoint(
		readEnv("ACTIONS_INDEXER_URL") ?? mainnetDefaults.actionsIndexerUrl
	),
	l1ArchiveUrl: normalizeEndpoint(readEnv("L1_ARCHIVE_URL") ?? mainnetDefaults.l1ArchiveUrl),
	l2ArchiveUrl: normalizeEndpoint(readEnv("L2_ARCHIVE_URL") ?? mainnetDefaults.l2ArchiveUrl),
	l1DaemonUrl: normalizeEndpoint(readEnv("L1_DAEMON_URL") ?? mainnetDefaults.l1DaemonUrl),
	l2DaemonUrl: normalizeEndpoint(readEnv("L2_DAEMON_URL") ?? mainnetDefaults.l2DaemonUrl)
})

export const summarizeServices = (services: ServiceProbe[]): Record<ServiceStatus, number> =>
	services.reduce<Record<ServiceStatus, number>>(
		(summary, service) => ({
			...summary,
			[service.status]: summary[service.status] + 1
		}),
		{ ok: 0, warn: 0, error: 0, unknown: 0 }
	)

const timedFetch = async (url: string, init?: RequestInit) => {
	const controller = new AbortController()
	const startedAt = performance.now()
	const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

	try {
		const response = await fetch(url, {
			...init,
			signal: controller.signal
		})
		return {
			response,
			latencyMs: Math.round(performance.now() - startedAt)
		}
	} finally {
		clearTimeout(timeout)
	}
}

const readJson = async (response: Response): Promise<unknown> => {
	const text = await response.text()
	if (!text) return null
	try {
		return JSON.parse(text) as unknown
	} catch {
		return text
	}
}

const getRecord = (value: unknown): Record<string, unknown> =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}

const getNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : null
	}
	return null
}

const getString = (value: unknown): string | null =>
	typeof value === "string" && value.trim() !== "" ? value : null

const getDisplayString = (value: unknown): string | null => {
	const stringValue = getString(value)
	if (stringValue !== null) return stringValue
	if (typeof value === "object" && value !== null) return JSON.stringify(value)
	return null
}

const getFirstError = (payload: unknown): string | undefined => {
	const errors = getRecord(payload).errors
	if (!Array.isArray(errors)) return
	const first = getRecord(errors[0])
	return getString(first.message) ?? JSON.stringify(errors[0])
}

const makeProbeError = ({
	id,
	label,
	kind,
	endpoint,
	error
}: {
	id: string
	label: string
	kind: ServiceKind
	endpoint: string
	error: unknown
}): ServiceProbe => ({
	id,
	label,
	kind,
	status: "error",
	endpoint,
	checkedAt: new Date().toISOString(),
	latencyMs: null,
	httpStatus: null,
	details: {},
	error: error instanceof Error ? error.message : String(error)
})

const graphQlRequest = async (endpoint: string, query: string) => {
	const { response, latencyMs } = await timedFetch(endpoint, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query })
	})
	const payload = await readJson(response)
	return { response, latencyMs, payload }
}

export const probeArchive = async ({
	id,
	label,
	endpoint
}: {
	id: string
	label: string
	endpoint: string
}): Promise<ServiceProbe> => {
	try {
		const { response, latencyMs, payload } = await graphQlRequest(
			endpoint,
			`query OpsArchiveState {
				networkState {
					maxBlockHeight {
						canonicalMaxBlockHeight
						pendingMaxBlockHeight
					}
				}
			}`
		)
		const error = getFirstError(payload)
		const data = getRecord(getRecord(payload).data)
		const networkState = getRecord(data.networkState)
		const maxBlockHeight = getRecord(networkState.maxBlockHeight)
		const canonicalHeight = getNumber(maxBlockHeight.canonicalMaxBlockHeight)
		const pendingHeight = getNumber(maxBlockHeight.pendingMaxBlockHeight)
		const isOk =
			response.ok && error == null && (canonicalHeight !== null || pendingHeight !== null)

		return {
			id,
			label,
			kind: "archive",
			status: isOk ? "ok" : response.ok ? "warn" : "error",
			endpoint,
			checkedAt: new Date().toISOString(),
			latencyMs,
			httpStatus: response.status,
			details: {
				canonicalMaxBlockHeight: canonicalHeight,
				pendingMaxBlockHeight: pendingHeight
			},
			...(error && { error })
		}
	} catch (error) {
		return makeProbeError({ id, label, kind: "archive", endpoint, error })
	}
}

export const probeDaemon = async ({
	id,
	label,
	endpoint
}: {
	id: string
	label: string
	endpoint: string
}): Promise<ServiceProbe> => {
	try {
		const statusResult = await graphQlRequest(
			endpoint,
			`query OpsDaemonState {
				syncStatus
				daemonStatus
			}`
		)
		const statusError = getFirstError(statusResult.payload)
		const statusData = getRecord(getRecord(statusResult.payload).data)
		const syncStatus = getString(statusData.syncStatus)
		const daemonStatus = getDisplayString(statusData.daemonStatus)
		const details: ServiceProbe["details"] = {
			syncStatus,
			daemonStatus,
			blockHeight: null,
			slotSinceGenesis: null,
			stateHash: null
		}

		let chainError: string | undefined
		if (statusResult.response.ok && statusError == null) {
			try {
				const chainResult = await graphQlRequest(
					endpoint,
					`query OpsDaemonHead {
				bestChain(maxLength: 1) {
					stateHash
					protocolState {
						consensusState {
							blockHeight
							slotSinceGenesis
						}
					}
				}
			}`
				)
				chainError = getFirstError(chainResult.payload)
				const chainData = getRecord(getRecord(chainResult.payload).data)
				const bestChain = Array.isArray(chainData.bestChain)
					? getRecord(chainData.bestChain[0])
					: {}
				const protocolState = getRecord(bestChain.protocolState)
				const consensusState = getRecord(protocolState.consensusState)
				details.blockHeight = getNumber(consensusState.blockHeight)
				details.slotSinceGenesis = getNumber(consensusState.slotSinceGenesis)
				details.stateHash = getString(bestChain.stateHash)
			} catch (error) {
				chainError = error instanceof Error ? error.message : String(error)
			}
		}

		const isSynced = syncStatus === null || syncStatus.toUpperCase() === "SYNCED"
		const isOk = statusResult.response.ok && statusError == null && isSynced

		return {
			id,
			label,
			kind: "daemon",
			status: isOk ? "ok" : statusResult.response.ok ? "warn" : "error",
			endpoint,
			checkedAt: new Date().toISOString(),
			latencyMs: statusResult.latencyMs,
			httpStatus: statusResult.response.status,
			details: {
				...details,
				...(chainError && { chainHead: chainError })
			},
			...(statusError && { error: statusError })
		}
	} catch (error) {
		return makeProbeError({ id, label, kind: "daemon", endpoint, error })
	}
}

export const probeActionsIndexer = async ({
	endpoint,
	token
}: {
	endpoint: string
	token?: string
}): Promise<ServiceProbe> => {
	const id = "actions-indexer"
	const label = "Actions indexer"
	try {
		const health = await timedFetch(`${endpoint}/health`)
		const healthPayload = await readJson(health.response)
		const healthRecord = getRecord(healthPayload)
		const indexer = getRecord(healthRecord.indexer)
		const database = getRecord(healthRecord.database)
		const healthStatus = getString(healthRecord.status)
		const details: ServiceProbe["details"] = {
			health: healthStatus,
			database: getString(database.status),
			indexer: getString(indexer.status),
			consecutiveErrors: getNumber(indexer.consecutiveErrors),
			lastFetchedOuter: getNumber(getRecord(indexer.lastFetchedBlock).outer),
			lastFetchedInner: getNumber(getRecord(indexer.lastFetchedBlock).inner)
		}

		let statusError: string | undefined
		if (token) {
			const status = await timedFetch(`${endpoint}/status`, {
				headers: { authorization: `Bearer ${token}` }
			})
			const statusPayload = await readJson(status.response)
			const statusRecord = getRecord(statusPayload)
			details.running = typeof statusRecord.isRunning === "boolean" ? statusRecord.isRunning : null
			details.intervalSeconds = getNumber(getRecord(statusRecord.config).intervalSeconds)
			details.statusHttp = status.response.status
			if (!status.response.ok) statusError = JSON.stringify(statusPayload)
		} else {
			details.running = null
			statusError =
				"ACTIONS_INDEXER_TOKEN is not set; authenticated status and controls are disabled."
		}

		const status =
			health.response.ok && healthStatus === "healthy"
				? token
					? "ok"
					: "warn"
				: health.response.ok
					? "warn"
					: "error"

		return {
			id,
			label,
			kind: "actions-indexer",
			status,
			endpoint,
			checkedAt: new Date().toISOString(),
			latencyMs: health.latencyMs,
			httpStatus: health.response.status,
			details,
			...(statusError && { error: statusError })
		}
	} catch (error) {
		return makeProbeError({ id, label, kind: "actions-indexer", endpoint, error })
	}
}

export const readActionsIndexerToken = (): string | undefined => readEnv("ACTIONS_INDEXER_TOKEN")

export const createOpsSnapshot = async (): Promise<OpsSnapshot> => {
	const config = getOpsConfig()
	const token = readActionsIndexerToken()
	const services = await Promise.all([
		probeActionsIndexer({ endpoint: config.actionsIndexerUrl, token }),
		probeArchive({ id: "l1-archive", label: "L1 archive", endpoint: config.l1ArchiveUrl }),
		probeArchive({ id: "l2-archive", label: "L2 archive", endpoint: config.l2ArchiveUrl }),
		probeDaemon({ id: "l1-daemon", label: "L1 daemon", endpoint: config.l1DaemonUrl }),
		probeDaemon({ id: "l2-daemon", label: "L2 daemon", endpoint: config.l2DaemonUrl })
	])

	return {
		checkedAt: new Date().toISOString(),
		config,
		summary: summarizeServices(services),
		services
	}
}

export const runIndexerControl = async (action: ControlAction): Promise<unknown> => {
	const token = readActionsIndexerToken()
	if (!token) {
		throw new Error("ACTIONS_INDEXER_TOKEN is required for indexer control actions")
	}

	const endpoint = getOpsConfig().actionsIndexerUrl
	const { response } = await timedFetch(`${endpoint}/${action}`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}` }
	})
	const payload = await readJson(response)

	if (!response.ok) {
		throw new Error(
			`${action} failed with HTTP ${response.status}: ${
				typeof payload === "string" ? payload : JSON.stringify(payload)
			}`
		)
	}

	return payload
}
