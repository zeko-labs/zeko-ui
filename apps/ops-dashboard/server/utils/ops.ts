export type ServiceKind = "actions-indexer" | "archive" | "daemon"
export type ServiceStatus = "ok" | "warn" | "error" | "unknown"
export type OpsNetwork = "mainnet" | "testnet"

export interface OpsEndpointConfig {
	network: OpsNetwork
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

const opsDefaults: Record<OpsNetwork, OpsEndpointConfig> = {
	mainnet: {
		network: "mainnet",
		actionsIndexerUrl: "https://indexer.actions.zeko.io",
		l1ArchiveUrl: "https://gateway.mina.archive.mainnet.zeko.io",
		l2ArchiveUrl: "https://archive.mainnet.zeko.io/graphql",
		l1DaemonUrl: "https://gateway.mina.mainnet.zeko.io",
		l2DaemonUrl: "https://mainnet.zeko.io/graphql"
	},
	testnet: {
		network: "testnet",
		actionsIndexerUrl: "https://testnet.indexer.actions.zeko.io",
		l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
		l2ArchiveUrl: "https://archive.testnet.zeko.io/graphql",
		l1DaemonUrl: "https://gateway.mina.devnet.zeko.io",
		l2DaemonUrl: "https://testnet.zeko.io/graphql"
	}
}

const readEnv = (key: string): string | undefined => {
	const value = process.env[key]?.trim()
	return value ? value : undefined
}

export const normalizeEndpoint = (url: string): string => url.replace(/\/+$/, "")

const endpointEnvKeys = {
	actionsIndexerUrl: "ACTIONS_INDEXER_URL",
	l1ArchiveUrl: "L1_ARCHIVE_URL",
	l2ArchiveUrl: "L2_ARCHIVE_URL",
	l1DaemonUrl: "L1_DAEMON_URL",
	l2DaemonUrl: "L2_DAEMON_URL"
} as const

export const resolveOpsNetwork = (value: unknown): OpsNetwork =>
	value === "testnet" || value === "mainnet" ? value : "mainnet"

const readNetworkEndpoint = (network: OpsNetwork, key: keyof typeof endpointEnvKeys): string => {
	const envKey = endpointEnvKeys[key]
	const networkEnvKey = `${network.toUpperCase()}_${envKey}`
	const defaultValue = opsDefaults[network][key]
	const globalOverride = network === "mainnet" ? readEnv(envKey) : undefined
	return normalizeEndpoint(readEnv(networkEnvKey) ?? globalOverride ?? defaultValue)
}

export const getOpsConfig = (networkInput?: unknown): OpsEndpointConfig => {
	const network = resolveOpsNetwork(networkInput)
	return {
		network,
		actionsIndexerUrl: readNetworkEndpoint(network, "actionsIndexerUrl"),
		l1ArchiveUrl: readNetworkEndpoint(network, "l1ArchiveUrl"),
		l2ArchiveUrl: readNetworkEndpoint(network, "l2ArchiveUrl"),
		l1DaemonUrl: readNetworkEndpoint(network, "l1DaemonUrl"),
		l2DaemonUrl: readNetworkEndpoint(network, "l2DaemonUrl")
	}
}

const toPascal = (key: string): string => {
	const normalized = key.replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) =>
		character.toUpperCase()
	)
	return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const flattenPrimitiveLeaves = (
	value: unknown,
	prefix: string,
	depth = 0
): ServiceProbe["details"] => {
	if (depth > 4) return {}
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return { [prefix]: value }
	}
	if (Array.isArray(value)) return { [`${prefix}Count`]: value.length }
	if (typeof value !== "object") return {}

	return Object.entries(value as Record<string, unknown>).reduce<ServiceProbe["details"]>(
		(details, [key, child]) => ({
			...details,
			...flattenPrimitiveLeaves(child, `${prefix}${toPascal(key)}`, depth + 1)
		}),
		{}
	)
}

const mergeRecords = (
	base: Record<string, unknown>,
	override: Record<string, unknown>
): Record<string, unknown> =>
	Array.from(new Set([...Object.keys(base), ...Object.keys(override)])).reduce<
		Record<string, unknown>
	>((merged, key) => {
		const baseValue = base[key]
		const overrideValue = override[key]
		return {
			...merged,
			[key]:
				typeof baseValue === "object" &&
				baseValue !== null &&
				!Array.isArray(baseValue) &&
				typeof overrideValue === "object" &&
				overrideValue !== null &&
				!Array.isArray(overrideValue)
					? mergeRecords(
							baseValue as Record<string, unknown>,
							overrideValue as Record<string, unknown>
						)
					: overrideValue ?? baseValue
		}
	}, {})

export const extractActionsIndexerDetails = ({
	healthPayload,
	statusPayload
}: {
	healthPayload: unknown
	statusPayload?: unknown
}): ServiceProbe["details"] => {
	const healthRecord = getRecord(healthPayload)
	const service = getRecord(healthRecord.service)
	const database = getRecord(healthRecord.database)
	const indexer = getRecord(healthRecord.indexer)
	const statusRecord = getRecord(statusPayload)
	const healthCanonicalProgress = getRecord(indexer.canonicalProgress)
	const statusCanonicalProgress = getRecord(statusRecord.canonicalProgress)
	const canonicalProgress = mergeRecords(healthCanonicalProgress, statusCanonicalProgress)
	const outerProgress = getRecord(canonicalProgress.outer)
	const innerProgress = getRecord(canonicalProgress.inner)
	const lastFetchedBlock = getRecord(indexer.lastFetchedBlock)

	return {
		...flattenPrimitiveLeaves(database, "database"),
		...flattenPrimitiveLeaves(statusRecord, "status"),
		health: getString(healthRecord.status),
		environment: getString(service.environment),
		databaseStatus: getString(database.status),
		databaseLatencyMs: getNumber(database.latency_ms ?? database.latencyMs),
		databaseCheckedAt: getString(database.checkedAt),
		databaseAgeMs: getNumber(database.ageMs),
		databaseError: getString(database.error),
		indexer: getString(indexer.status),
		consecutiveErrors: getNumber(indexer.consecutiveErrors),
		lastFetchedOuter: getNumber(lastFetchedBlock.outer),
		lastFetchedInner: getNumber(lastFetchedBlock.inner),
		running: typeof statusRecord.isRunning === "boolean" ? statusRecord.isRunning : null,
		intervalSeconds: getNumber(getRecord(statusRecord.config).intervalSeconds),
		canonicalCheckedAt: getString(canonicalProgress.checkedAt),
		canonicalAgeMs: getNumber(canonicalProgress.ageMs),
		canonicalError: getString(canonicalProgress.error),
		outerLastFinalIndex: getNumber(outerProgress.lastFinalIndex),
		outerLastFinalBlockHeight: getNumber(outerProgress.lastFinalBlockHeight),
		outerNonCanonicalTailCount: getNumber(outerProgress.nonCanonicalTailCount),
		innerLastFinalIndex: getNumber(innerProgress.lastFinalIndex),
		innerLastFinalBlockHeight: getNumber(innerProgress.lastFinalBlockHeight),
		innerNonCanonicalTailCount: getNumber(innerProgress.nonCanonicalTailCount)
	}
}

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
		const healthStatus = getString(healthRecord.status)

		let statusHttp: number | null = null
		let statusPayload: unknown
		let statusError: string | undefined
		if (token) {
			const status = await timedFetch(`${endpoint}/status`, {
				headers: { authorization: `Bearer ${token}` }
			})
			statusHttp = status.response.status
			statusPayload = await readJson(status.response)
			if (!status.response.ok) statusError = JSON.stringify(statusPayload)
		} else {
			statusError =
				"ACTIONS_INDEXER_TOKEN is not set; authenticated status and controls are disabled."
		}
		const details = {
			...extractActionsIndexerDetails({ healthPayload, statusPayload }),
			statusHttp
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

export const readActionsIndexerToken = (network: OpsNetwork): string | undefined =>
	readEnv(`${network.toUpperCase()}_ACTIONS_INDEXER_TOKEN`) ?? readEnv("ACTIONS_INDEXER_TOKEN")

export const createOpsSnapshot = async (networkInput?: unknown): Promise<OpsSnapshot> => {
	const config = getOpsConfig(networkInput)
	const token = readActionsIndexerToken(config.network)
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

export const runIndexerControl = async (
	action: ControlAction,
	networkInput?: unknown
): Promise<unknown> => {
	const config = getOpsConfig(networkInput)
	const token = readActionsIndexerToken(config.network)
	if (!token) {
		throw new Error(
			`${config.network.toUpperCase()}_ACTIONS_INDEXER_TOKEN or ACTIONS_INDEXER_TOKEN is required for indexer control actions`
		)
	}

	const { response } = await timedFetch(`${config.actionsIndexerUrl}/${action}`, {
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
