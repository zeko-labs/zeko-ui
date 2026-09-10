export type ServiceKind = "actions-indexer" | "actions-api" | "archive" | "daemon"
export type ServiceStatus = "ok" | "warn" | "error" | "unknown"
export type OpsNetwork = "sepolia"
export type OpsEnv = Record<string, unknown>

export interface OpsEndpointConfig {
	network: OpsNetwork
	actionsIndexerUrl: string
	actionsApiUrl: string
	l1ArchiveUrl: string
	l2ArchiveUrl: string
	l1DaemonUrl: string | null
	l2DaemonUrl: string | null
	outerActionsPublicKey: string
	innerActionsPublicKey: string
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

export interface ActionCoverageSnapshot {
	l1: ServiceProbe["details"]
	l2: ServiceProbe["details"]
}

export type ControlAction = "start" | "stop" | "rebuild" | "reset"

export interface ControlRequestSecurity {
	contentType?: string | null
	origin?: string | null
	requestOrigin?: string | null
	secFetchSite?: string | null
}

type HeaderMap = Record<string, string | string[] | undefined>

const requestTimeoutMs = 12_000
export const indexerControlTimeoutMs = 300_000
const retryDelaysMs = [0, 350, 1_000]
const actionScanRangeSize = 10_000
const maxActionScanRanges = 6

const opsDefaults: Record<OpsNetwork, OpsEndpointConfig> = {
	sepolia: {
		network: "sepolia",
		actionsIndexerUrl: "https://sepolia.indexer.actions.zeko.io",
		actionsApiUrl: "https://sepolia.api.actions.zeko.io/graphql",
		l1ArchiveUrl: "https://sepolia-gateway.zeko.io/graphql",
		l2ArchiveUrl: "https://archive.sepolia.zeko.io/graphql",
		l1DaemonUrl: null,
		l2DaemonUrl: "https://sepolia.zeko.io/graphql",
		outerActionsPublicKey: "B62qpggUSofPZcWqtgbmLVnSAzzjAqSXjyckLJaBeGmXiPnc2mGUfhf",
		innerActionsPublicKey: "B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1"
	}
}

const readEnv = (env: OpsEnv, key: string): string | undefined => {
	const rawValue = env[key]
	const value = typeof rawValue === "string" ? rawValue.trim() : undefined
	return value ? value : undefined
}

export const normalizeEndpoint = (url: string): string => url.replace(/\/+$/, "")

const endpointEnvKeys = {
	actionsIndexerUrl: "ACTIONS_INDEXER_URL",
	actionsApiUrl: "ACTIONS_API_URL",
	l1ArchiveUrl: "L1_ARCHIVE_URL",
	l2ArchiveUrl: "L2_ARCHIVE_URL",
	l1DaemonUrl: "L1_DAEMON_URL",
	l2DaemonUrl: "L2_DAEMON_URL"
} as const

const publicKeyEnvKeys = {
	outerActionsPublicKey: "OUTER_ACTIONS_PUBLIC_KEY",
	innerActionsPublicKey: "INNER_ACTIONS_PUBLIC_KEY"
} as const

export const resolveOpsNetwork = (_value?: unknown): OpsNetwork => "sepolia"

export const resolveControlNetwork = (value: unknown): OpsNetwork => {
	if (value === "sepolia") return value
	throw new Error("Unsupported network")
}

const normalizeOrigin = (value?: string | null): string | null => {
	if (!value) return null
	try {
		return new URL(value).origin
	} catch {
		return null
	}
}

const readHeader = (headers: HeaderMap, name: string): string | null => {
	const value = headers[name]
	if (Array.isArray(value)) return value[0] ?? null
	return value ?? null
}

export const resolveControlRequestOrigin = (headers: HeaderMap): string | null => {
	const host = readHeader(headers, "x-forwarded-host") ?? readHeader(headers, "host")
	if (!host) return null

	const forwardedProto = readHeader(headers, "x-forwarded-proto")?.split(",")[0]?.trim()
	const origin = normalizeOrigin(readHeader(headers, "origin"))
	const originUrl = origin === null ? null : new URL(origin)
	const proto =
		forwardedProto ??
		(originUrl !== null && originUrl.host === host ? originUrl.protocol.replace(/:$/, "") : "https")
	return `${proto}://${host}`
}

export const isControlRequestAllowed = ({
	contentType,
	origin,
	requestOrigin,
	secFetchSite
}: ControlRequestSecurity): boolean => {
	const mediaType = contentType?.split(";")[0]?.trim().toLowerCase()
	if (mediaType !== "application/json") return false

	const fetchSite = secFetchSite?.trim().toLowerCase()
	if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false

	const normalizedOrigin = normalizeOrigin(origin)
	if (!normalizedOrigin) return true

	const normalizedRequestOrigin = normalizeOrigin(requestOrigin)
	return normalizedRequestOrigin !== null && normalizedOrigin === normalizedRequestOrigin
}

const defaultEnv = (): OpsEnv => process.env

export const resolveRouteEnv = (cloudflareEnv?: OpsEnv): OpsEnv => ({
	...process.env,
	...(cloudflareEnv ?? {})
})

const readNetworkEndpoint = (
	network: OpsNetwork,
	key: keyof typeof endpointEnvKeys,
	env: OpsEnv
): string | null => {
	const envKey = endpointEnvKeys[key]
	const networkEnvKey = `${network.toUpperCase()}_${envKey}`
	const defaultValue = opsDefaults[network][key]
	const networkOverride = readEnv(env, networkEnvKey)
	if (networkOverride !== undefined) return normalizeEndpoint(networkOverride)
	return defaultValue === null ? null : normalizeEndpoint(defaultValue)
}

const requireNetworkEndpoint = (
	network: OpsNetwork,
	key: keyof typeof endpointEnvKeys,
	env: OpsEnv
): string => {
	const endpoint = readNetworkEndpoint(network, key, env)
	if (endpoint === null) throw new Error(`No ${network} ${key} endpoint is configured`)
	return endpoint
}

const readNetworkPublicKey = (
	network: OpsNetwork,
	key: keyof typeof publicKeyEnvKeys,
	env: OpsEnv
): string => {
	const envKey = publicKeyEnvKeys[key]
	const networkEnvKey = `${network.toUpperCase()}_${envKey}`
	const defaultValue = opsDefaults[network][key]
	return readEnv(env, networkEnvKey) ?? defaultValue
}

export const getOpsConfig = (
	networkInput?: unknown,
	env: OpsEnv = defaultEnv()
): OpsEndpointConfig => {
	const network = resolveOpsNetwork(networkInput)
	return {
		network,
		actionsIndexerUrl: requireNetworkEndpoint(network, "actionsIndexerUrl", env),
		actionsApiUrl: requireNetworkEndpoint(network, "actionsApiUrl", env),
		l1ArchiveUrl: requireNetworkEndpoint(network, "l1ArchiveUrl", env),
		l2ArchiveUrl: requireNetworkEndpoint(network, "l2ArchiveUrl", env),
		l1DaemonUrl: readNetworkEndpoint(network, "l1DaemonUrl", env),
		l2DaemonUrl: readNetworkEndpoint(network, "l2DaemonUrl", env),
		outerActionsPublicKey: readNetworkPublicKey(network, "outerActionsPublicKey", env),
		innerActionsPublicKey: readNetworkPublicKey(network, "innerActionsPublicKey", env)
	}
}

export const getActionsIndexerRequestUrl = (
	networkInput?: unknown,
	env: OpsEnv = defaultEnv()
): string => {
	const network = resolveOpsNetwork(networkInput)
	return getOpsConfig(network, env).actionsIndexerUrl
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

const formatNumber = (value: number): string => value.toLocaleString("en-US")

const formatNullableNumber = (value: number | null): string =>
	value === null ? "unknown" : formatNumber(value)

const actionsIndexerFinalityWarning = (
	details: ServiceProbe["details"]
): { details: ServiceProbe["details"]; error?: string } => {
	const outerTailCount = getNumber(details.outerNonCanonicalTailCount)
	const finalOuterBlock = getNumber(details.outerLastFinalBlockHeight)
	const fetchedOuterBlock = getNumber(details.lastFetchedOuter)
	const finalityLagBlocks =
		finalOuterBlock === null || fetchedOuterBlock === null
			? null
			: Math.max(0, fetchedOuterBlock - finalOuterBlock)
	const outerFinalityDegraded =
		outerTailCount !== null &&
		outerTailCount > 0 &&
		(finalOuterBlock === null || fetchedOuterBlock === null || fetchedOuterBlock > finalOuterBlock)

	if (!outerFinalityDegraded) {
		return {
			details: {
				...details,
				outerFinalityLagBlocks: finalityLagBlocks
			}
		}
	}

	const unit = outerTailCount === 1 ? "action is" : "actions are"

	return {
		details: {
			...details,
			outerFinalityLagBlocks: finalityLagBlocks,
			outerFinalityDegraded: true
		},
		error: `Bridge finality degraded: ${formatNumber(outerTailCount)} outer ${unit} not final; final outer block ${formatNullableNumber(finalOuterBlock)}, fetched outer block ${formatNullableNumber(fetchedOuterBlock)}.`
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

const wait = (delayMs: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, delayMs))

interface TimedFetchOptions {
	timeoutMs?: number
	retryDelays?: readonly number[]
}

const shouldRetryResponse = (response: Response): boolean =>
	response.status === 429 || (response.status >= 500 && response.status <= 599)

const timedFetch = async (url: string, init?: RequestInit, options: TimedFetchOptions = {}) => {
	const startedAt = performance.now()
	let lastError: unknown
	const delays = options.retryDelays ?? retryDelaysMs
	const timeoutMs = options.timeoutMs ?? requestTimeoutMs

	for (const [attempt, delayMs] of delays.entries()) {
		if (delayMs > 0) await wait(delayMs)
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), timeoutMs)

		try {
			const response = await fetch(url, {
				...init,
				redirect: "follow",
				signal: controller.signal
			})
			if (attempt < delays.length - 1 && shouldRetryResponse(response)) {
				continue
			}
			return {
				response,
				latencyMs: Math.round(performance.now() - startedAt)
			}
		} catch (error) {
			lastError = error
			if (attempt === delays.length - 1) throw error
		} finally {
			clearTimeout(timeout)
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError))
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

const indexerHeaders = (token?: string): Record<string, string> => ({
	...(token !== undefined && { authorization: `Bearer ${token}` })
})

const indexerRequestInit = (token?: string, init: RequestInit = {}): RequestInit => ({
	...init,
	headers: {
		...indexerHeaders(token),
		...(init.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {})
	}
})

const formatUnknownError = (error: unknown, fallback: string): string => {
	if (error instanceof Error && error.message.trim() !== "") return error.message
	if (typeof error === "string" && error.trim() !== "") return error
	if (error === null || error === undefined) return fallback
	return String(error)
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
	error: formatUnknownError(error, `Unknown error probing ${label}`)
})

const graphQlRequest = async (
	endpoint: string,
	query: string,
	timeoutMs?: number,
	variables?: Record<string, string | number>
) => {
	const { response, latencyMs } = await timedFetch(
		endpoint,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				query,
				...(variables && { variables })
			})
		},
		{ timeoutMs }
	)
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

export interface ArchiveActionBlock {
	height: number
	actionCount: number
}

export const summarizeActionCoverage = ({
	archiveHeight,
	actionBlocks,
	lastFetchedBlock,
	scanComplete
}: {
	archiveHeight: number | null
	actionBlocks: ArchiveActionBlock[]
	lastFetchedBlock: number | null
	scanComplete: boolean
}): ServiceProbe["details"] => {
	if (archiveHeight === null || lastFetchedBlock === null) {
		return {
			actionCoverageStatus: "unknown",
			missingActionCount: null,
			missingActionBlockCount: null,
			firstMissingActionBlock: null,
			latestArchiveActionBlock: null
		}
	}

	const missingActionCount = actionBlocks.reduce((total, block) => total + block.actionCount, 0)
	const heights = actionBlocks.map((block) => block.height)
	return {
		actionCoverageStatus: missingActionCount > 0 ? "missing" : scanComplete ? "current" : "partial",
		missingActionCount,
		missingActionBlockCount: actionBlocks.length,
		firstMissingActionBlock: heights.length === 0 ? null : Math.min(...heights),
		latestArchiveActionBlock: heights.length === 0 ? lastFetchedBlock : Math.max(...heights),
		actionScanComplete: scanComplete
	}
}

const prefixDetails = (
	prefix: "l1" | "l2",
	details: ServiceProbe["details"]
): ServiceProbe["details"] =>
	Object.fromEntries(
		Object.entries(details).map(([key, value]) => [`${prefix}${toPascal(key)}`, value])
	)

const readArchiveActionBlocks = async ({
	endpoint,
	from,
	publicKey,
	to
}: {
	endpoint: string
	from: number
	publicKey: string
	to: number
}): Promise<ArchiveActionBlock[]> => {
	const { response, payload } = await graphQlRequest(
		endpoint,
		`query OpsActionCoverage($pk: String!, $from: Int, $to: Int) {
			actions(input: { address: $pk, from: $from, to: $to }) {
				blockInfo {
					height
					chainStatus
				}
				actionData {
					data
				}
			}
		}`,
		requestTimeoutMs,
		{ pk: publicKey, from, to }
	)
	const error = getFirstError(payload)
	if (!response.ok || error) {
		throw new Error(error ?? `Archive actions query failed with HTTP ${response.status}`)
	}

	const data = getRecord(getRecord(payload).data)
	const actions = Array.isArray(data.actions) ? data.actions : []
	return actions.flatMap((item) => {
		const record = getRecord(item)
		const blockInfo = getRecord(record.blockInfo)
		const height = getNumber(blockInfo.height)
		const chainStatus = getString(blockInfo.chainStatus)
		if (height === null) return []
		if (chainStatus === "orphaned") return []
		const actionData = Array.isArray(record.actionData) ? record.actionData : []
		return [{ height, actionCount: Math.max(1, actionData.length) }]
	})
}

const probeArchiveActionCoverage = async ({
	archiveHeight,
	endpoint,
	lastFetchedBlock,
	publicKey
}: {
	archiveHeight: number | null
	endpoint: string
	lastFetchedBlock: number | null
	publicKey: string
}): Promise<ServiceProbe["details"]> => {
	if (archiveHeight === null || lastFetchedBlock === null) {
		return summarizeActionCoverage({
			archiveHeight,
			lastFetchedBlock,
			actionBlocks: [],
			scanComplete: false
		})
	}

	const scanFrom = lastFetchedBlock + 1
	if (scanFrom > archiveHeight) {
		return {
			...summarizeActionCoverage({
				archiveHeight,
				lastFetchedBlock,
				actionBlocks: [],
				scanComplete: true
			}),
			actionScanFrom: scanFrom,
			actionScanTo: archiveHeight
		}
	}

	const blocks: ArchiveActionBlock[] = []
	let from = scanFrom
	let ranges = 0
	while (from <= archiveHeight && ranges < maxActionScanRanges) {
		const to = Math.min(from + actionScanRangeSize, archiveHeight + 1)
		blocks.push(...(await readArchiveActionBlocks({ endpoint, from, publicKey, to })))
		from = to
		ranges++
	}

	return {
		...summarizeActionCoverage({
			archiveHeight,
			lastFetchedBlock,
			actionBlocks: blocks,
			scanComplete: from > archiveHeight
		}),
		actionScanFrom: scanFrom,
		actionScanTo: Math.min(from - 1, archiveHeight)
	}
}

const coverageProbeError = (error: unknown): ServiceProbe["details"] => ({
	actionCoverageStatus: "unknown",
	actionCoverageError: error instanceof Error ? error.message : String(error)
})

export const createActionCoverageSnapshot = async (
	networkInput: unknown,
	{
		lastFetchedOuter,
		lastFetchedInner
	}: {
		lastFetchedOuter: number | null
		lastFetchedInner: number | null
	},
	env: OpsEnv = defaultEnv()
): Promise<ActionCoverageSnapshot> => {
	const config = getOpsConfig(networkInput, env)
	const [l1Archive, l2Archive] = await Promise.all([
		probeArchive({ id: "l1-archive", label: "L1 archive", endpoint: config.l1ArchiveUrl }),
		probeArchive({ id: "l2-archive", label: "L2 archive", endpoint: config.l2ArchiveUrl })
	])
	const [l1, l2] = await Promise.all([
		probeArchiveActionCoverage({
			archiveHeight: getNumber(l1Archive.details.pendingMaxBlockHeight),
			endpoint: config.l1ArchiveUrl,
			lastFetchedBlock: lastFetchedOuter,
			publicKey: config.outerActionsPublicKey
		}).catch(coverageProbeError),
		probeArchiveActionCoverage({
			archiveHeight: getNumber(l2Archive.details.pendingMaxBlockHeight),
			endpoint: config.l2ArchiveUrl,
			lastFetchedBlock: lastFetchedInner,
			publicKey: config.innerActionsPublicKey
		}).catch(coverageProbeError)
	])

	return { l1, l2 }
}

export const probeDaemon = async ({
	id,
	label,
	endpoint,
	supportsBestChain
}: {
	id: string
	label: string
	endpoint: string | null
	supportsBestChain: boolean
}): Promise<ServiceProbe> => {
	if (endpoint === null) {
		return {
			id,
			label,
			kind: "daemon",
			status: "unknown",
			endpoint: "not configured",
			checkedAt: new Date().toISOString(),
			latencyMs: null,
			httpStatus: null,
			details: { supported: false },
			error: "No Sepolia L1 daemon endpoint is configured."
		}
	}

	try {
		const daemonTimeoutMs = 5_000
		const statusResult = await graphQlRequest(
			endpoint,
			`query OpsDaemonState {
					syncStatus
					daemonStatus {
						chainId
					}
				}`,
			daemonTimeoutMs
		)
		const statusError = getFirstError(statusResult.payload)
		const statusData = getRecord(getRecord(statusResult.payload).data)
		const syncStatus = getString(statusData.syncStatus)
		const daemonStatus = getDisplayString(statusData.daemonStatus)
		const details: ServiceProbe["details"] = {
			syncStatus,
			daemonStatus
		}

		let chainError: string | undefined
		if (supportsBestChain && statusResult.response.ok && statusError == null) {
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
			}`,
					daemonTimeoutMs
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
		} else if (!supportsBestChain) {
			details.blockModel = "1 block = 1 transaction"
			details.blockHeightSource = "archive"
		}

		const isSynced = syncStatus === null || syncStatus.toUpperCase() === "SYNCED"
		const hasRequiredHead =
			!supportsBestChain || (chainError === undefined && details.blockHeight !== null)
		const isOk = statusResult.response.ok && statusError == null && isSynced && hasRequiredHead

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
	requestEndpoint = endpoint,
	token
}: {
	endpoint: string
	requestEndpoint?: string
	token?: string
}): Promise<ServiceProbe> => {
	const id = "actions-indexer"
	const label = "Zeko action-indexer"
	try {
		const health = await timedFetch(`${requestEndpoint}/health`)
		const healthPayload = await readJson(health.response)
		const healthRecord = getRecord(healthPayload)
		const healthStatus = getString(healthRecord.status)
		const healthError =
			health.response.ok || healthStatus !== null
				? undefined
				: `Health check returned HTTP ${health.response.status}`

		let statusHttp: number | null = null
		let statusPayload: unknown
		let statusError: string | undefined
		if (token) {
			const status = await timedFetch(`${requestEndpoint}/status`, indexerRequestInit(token))
			statusHttp = status.response.status
			statusPayload = await readJson(status.response)
			if (!status.response.ok)
				statusError = `Status check returned HTTP ${status.response.status}: ${
					typeof statusPayload === "string" ? statusPayload : JSON.stringify(statusPayload)
				}`
		} else {
			statusError =
				"ACTIONS_INDEXER_TOKEN is not set; authenticated status and controls are disabled."
		}
		const finality = actionsIndexerFinalityWarning({
			...extractActionsIndexerDetails({ healthPayload, statusPayload }),
			statusHttp
		})
		const details = finality.details

		const status =
			health.response.ok &&
			healthStatus === "healthy" &&
			statusError === undefined &&
			finality.error === undefined
				? "ok"
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
			...(healthError || statusError || finality.error
				? { error: healthError ?? statusError ?? finality.error }
				: {})
		}
	} catch (error) {
		return makeProbeError({ id, label, kind: "actions-indexer", endpoint, error })
	}
}

const typeHasFinalityMetadata = (
	payload: unknown,
	alias: "outerAction" | "innerAction"
): boolean => {
	const data = getRecord(getRecord(payload).data)
	const typeInfo = getRecord(data[alias])
	const fields = Array.isArray(typeInfo.fields) ? typeInfo.fields : []
	const fieldNames = new Set(
		fields.flatMap((field) => {
			const name = getString(getRecord(field).name)
			return name === null ? [] : [name]
		})
	)
	return fieldNames.has("markedAsCanonicalAt") && fieldNames.has("finalityStatus")
}

const actionsApiMaxSlot = 2_147_483_647

const actionRecord = (value: unknown): Record<string, unknown> => getRecord(value)

const extractActionsApiFinalityDetails = (payload: unknown): ServiceProbe["details"] => {
	const data = getRecord(getRecord(payload).data)
	const result = getRecord(data.commitAsePastSlot)
	const commit = getRecord(result.commit)
	const ase = Array.isArray(result.ase) ? result.ase.map(actionRecord) : []
	const pendingCommitAnchor =
		getNumber(commit.index) !== null && getString(commit.markedAsCanonicalAt) === null
	const pendingTail = pendingCommitAnchor ? [commit, ...ase] : ase
	const first = pendingTail[0] ?? {}
	const last = pendingTail.at(-1) ?? {}

	return {
		finalOuterCommitIndex: getNumber(commit.index),
		finalOuterCommitBlockHeight: getNumber(commit.blockHeight),
		finalOuterCommitTimestamp: getString(commit.timestamp),
		finalOuterCommitMarkedAsCanonicalAt: getString(commit.markedAsCanonicalAt),
		finalOuterCommitInnerActionStateLength: getNumber(commit.innerActionStateLength),
		finalOuterCommitSynchronizedOuterActionStateLength: getNumber(
			commit.synchronizedOuterActionStateLength
		),
		pendingOuterTailCount: pendingTail.length,
		pendingOuterFirstIndex: getNumber(first.index),
		pendingOuterFirstBlockHeight: getNumber(first.blockHeight),
		pendingOuterFirstTimestamp: getString(first.timestamp),
		pendingOuterLastIndex: getNumber(last.index),
		pendingOuterLastBlockHeight: getNumber(last.blockHeight),
		pendingOuterLastTimestamp: getString(last.timestamp),
		pendingOuterLastKind: getString(last.kind),
		pendingOuterLastMarkedAsCanonicalAt: getString(last.markedAsCanonicalAt)
	}
}

const actionsApiFinalityWarning = (details: ServiceProbe["details"]): string | undefined => {
	const pendingTailCount = getNumber(details.pendingOuterTailCount)
	if (pendingTailCount === null || pendingTailCount <= 0) return undefined

	const unit = pendingTailCount === 1 ? "action" : "actions"
	const finalIndex = getNumber(details.finalOuterCommitIndex)
	const finalBlock = getNumber(details.finalOuterCommitBlockHeight)
	const pendingIndex = getNumber(details.pendingOuterLastIndex)
	const pendingBlock = getNumber(details.pendingOuterLastBlockHeight)
	const finalMarkedAsCanonicalAt = getString(details.finalOuterCommitMarkedAsCanonicalAt)

	if (finalMarkedAsCanonicalAt === null) {
		return `Actions API finality degraded: latest outer commit ${formatNullableNumber(finalIndex)} at block ${formatNullableNumber(finalBlock)} is pending and not marked canonical.`
	}

	return `Actions API finality degraded: ${formatNumber(pendingTailCount)} pending outer ${unit} after final commit ${formatNullableNumber(finalIndex)} at block ${formatNullableNumber(finalBlock)}; latest pending outer action ${formatNullableNumber(pendingIndex)} at block ${formatNullableNumber(pendingBlock)}.`
}

const probeActionsApiFinality = async (
	endpoint: string
): Promise<{
	status: ServiceStatus
	details: ServiceProbe["details"]
	error?: string
}> => {
	const { response, payload } = await graphQlRequest(
		endpoint,
		`query OpsActionsApiFinality($slot: Int!) {
			commitAsePastSlot(slot: $slot) {
				commit {
					index
					blockHeight
					timestamp
					innerActionStateLength
					synchronizedOuterActionStateLength
					markedAsCanonicalAt
				}
				ase {
					... on Commit {
						index
						blockHeight
						timestamp
						kind
						innerActionStateLength
						synchronizedOuterActionStateLength
						markedAsCanonicalAt
					}
					... on Witness {
						index
						blockHeight
						timestamp
						kind
						markedAsCanonicalAt
					}
				}
			}
		}`,
		requestTimeoutMs,
		{ slot: actionsApiMaxSlot }
	)
	const error = getFirstError(payload)
	const details = extractActionsApiFinalityDetails(payload)
	const requestError = response.ok
		? undefined
		: `Actions API finality query failed with HTTP ${response.status}`
	const warning = requestError ?? error ?? actionsApiFinalityWarning(details)
	const status: ServiceStatus = !response.ok ? "error" : warning ? "warn" : "ok"

	return {
		status,
		details,
		...(warning && { error: warning })
	}
}

export const probeActionsApi = async ({
	endpoint
}: { endpoint: string }): Promise<ServiceProbe> => {
	const id = "actions-api"
	const label = "Zeko actions API"
	try {
		const { response, latencyMs, payload } = await graphQlRequest(
			endpoint,
			`query OpsActionsApiSchema {
				outerAction: __type(name: "OuterAction") {
					fields {
						name
					}
				}
				innerAction: __type(name: "InnerAction") {
					fields {
						name
					}
				}
			}`,
			requestTimeoutMs
		)
		const error = getFirstError(payload)
		const outerActionFinalityMetadata = response.ok
			? typeHasFinalityMetadata(payload, "outerAction")
			: false
		const innerActionFinalityMetadata = response.ok
			? typeHasFinalityMetadata(payload, "innerAction")
			: false
		const hasFinalityMetadata = outerActionFinalityMetadata && innerActionFinalityMetadata
		const finality =
			response.ok && error == null && hasFinalityMetadata
				? await probeActionsApiFinality(endpoint)
				: {
						status: "ok" as const,
						details: {}
					}
		const status: ServiceStatus =
			!response.ok || error
				? "error"
				: !hasFinalityMetadata
					? "warn"
					: finality.status === "error"
						? "error"
						: finality.status === "warn"
							? "warn"
							: "ok"
		const compatibilityError =
			error ??
			(hasFinalityMetadata ? finality.error : "Actions API schema is missing finality metadata")

		return {
			id,
			label,
			kind: "actions-api",
			status,
			endpoint,
			checkedAt: new Date().toISOString(),
			latencyMs,
			httpStatus: response.status,
			details: {
				outerActionFinalityMetadata,
				innerActionFinalityMetadata,
				...finality.details
			},
			...(compatibilityError && { error: compatibilityError })
		}
	} catch (error) {
		return makeProbeError({ id, label, kind: "actions-api", endpoint, error })
	}
}

export const readActionsIndexerToken = (
	_network: OpsNetwork,
	env: OpsEnv = defaultEnv()
): string | undefined => readEnv(env, "SEPOLIA_ACTIONS_INDEXER_TOKEN")

export const createOpsSnapshot = async (
	networkInput?: unknown,
	env: OpsEnv = defaultEnv()
): Promise<OpsSnapshot> => {
	const config = getOpsConfig(networkInput, env)
	const actionsIndexerRequestUrl = getActionsIndexerRequestUrl(config.network, env)
	const token = readActionsIndexerToken(config.network, env)
	const [indexer, actionsApi, l1Archive, l2Archive, l1Daemon, l2Daemon] = await Promise.all([
		probeActionsIndexer({
			endpoint: config.actionsIndexerUrl,
			requestEndpoint: actionsIndexerRequestUrl,
			token
		}),
		probeActionsApi({ endpoint: config.actionsApiUrl }),
		probeArchive({ id: "l1-archive", label: "L1 archive", endpoint: config.l1ArchiveUrl }),
		probeArchive({ id: "l2-archive", label: "L2 archive", endpoint: config.l2ArchiveUrl }),
		probeDaemon({
			id: "l1-daemon",
			label: "L1 daemon",
			endpoint: config.l1DaemonUrl,
			supportsBestChain: true
		}),
		probeDaemon({
			id: "l2-daemon",
			label: "L2 daemon",
			endpoint: config.l2DaemonUrl,
			supportsBestChain: false
		})
	])
	const { l1: l1Coverage, l2: l2Coverage } = await createActionCoverageSnapshot(
		config.network,
		{
			lastFetchedOuter: getNumber(indexer.details.lastFetchedOuter),
			lastFetchedInner: getNumber(indexer.details.lastFetchedInner)
		},
		env
	)
	const services = [
		{
			...indexer,
			details: {
				...indexer.details,
				...prefixDetails("l1", l1Coverage),
				...prefixDetails("l2", l2Coverage)
			}
		},
		actionsApi,
		l1Archive,
		l2Archive,
		l1Daemon,
		l2Daemon
	]

	return {
		checkedAt: new Date().toISOString(),
		config,
		summary: summarizeServices(services),
		services
	}
}

export const runIndexerControl = async (
	action: ControlAction,
	networkInput?: unknown,
	env: OpsEnv = defaultEnv()
): Promise<unknown> => {
	const config = getOpsConfig(networkInput, env)
	const actionsIndexerRequestUrl = getActionsIndexerRequestUrl(config.network, env)
	const token = readActionsIndexerToken(config.network, env)
	if (!token) {
		throw new Error("SEPOLIA_ACTIONS_INDEXER_TOKEN is required for indexer control actions")
	}

	const { response } = await timedFetch(
		`${actionsIndexerRequestUrl}/${action}`,
		{
			...indexerRequestInit(token, { method: "POST" })
		},
		{
			timeoutMs: indexerControlTimeoutMs,
			retryDelays: [0]
		}
	)
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
