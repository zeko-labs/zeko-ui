export type ServiceKind = "actions-indexer" | "archive" | "daemon"
export type ServiceStatus = "ok" | "warn" | "error" | "unknown"
export type OpsNetwork = "mainnet" | "testnet"
export type OpsEnv = Record<string, unknown>

export interface OpsEndpointConfig {
	network: OpsNetwork
	actionsIndexerUrl: string
	l1ArchiveUrl: string
	l2ArchiveUrl: string
	l1DaemonUrl: string
	l2DaemonUrl: string
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
const retryDelaysMs = [0, 350, 1_000]
const actionScanRangeSize = 10_000
const maxActionScanRanges = 6

const opsDefaults: Record<OpsNetwork, OpsEndpointConfig> = {
	mainnet: {
		network: "mainnet",
		actionsIndexerUrl: "https://indexer.actions.zeko.io",
		l1ArchiveUrl: "https://gateway.mina.archive.mainnet.zeko.io",
		l2ArchiveUrl: "https://archive.mainnet.zeko.io/graphql",
		l1DaemonUrl: "https://gateway.mina.mainnet.zeko.io",
		l2DaemonUrl: "https://mainnet.zeko.io/graphql",
		outerActionsPublicKey: "B62qm46jqHb9HAYiyGJeYkWgqNtPQEiTcssuoiua8VvKJGDStFsRcyC",
		innerActionsPublicKey: "B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1"
	},
	testnet: {
		network: "testnet",
		actionsIndexerUrl: "https://testnet.indexer.actions.zeko.io",
		l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
		l2ArchiveUrl: "https://archive.testnet.zeko.io/graphql",
		l1DaemonUrl: "https://gateway.mina.devnet.zeko.io",
		l2DaemonUrl: "https://testnet.zeko.io/graphql",
		outerActionsPublicKey: "B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2",
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
	l1ArchiveUrl: "L1_ARCHIVE_URL",
	l2ArchiveUrl: "L2_ARCHIVE_URL",
	l1DaemonUrl: "L1_DAEMON_URL",
	l2DaemonUrl: "L2_DAEMON_URL"
} as const

const publicKeyEnvKeys = {
	outerActionsPublicKey: "OUTER_ACTIONS_PUBLIC_KEY",
	innerActionsPublicKey: "INNER_ACTIONS_PUBLIC_KEY"
} as const

export const resolveOpsNetwork = (value: unknown): OpsNetwork =>
	value === "testnet" || value === "mainnet" ? value : "mainnet"

export const resolveControlNetwork = (value: unknown): OpsNetwork => {
	if (value === "testnet" || value === "mainnet") return value
	throw new Error("Unsupported control network")
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
): string => {
	const envKey = endpointEnvKeys[key]
	const networkEnvKey = `${network.toUpperCase()}_${envKey}`
	const defaultValue = opsDefaults[network][key]
	const globalOverride = network === "mainnet" ? readEnv(env, envKey) : undefined
	return normalizeEndpoint(readEnv(env, networkEnvKey) ?? globalOverride ?? defaultValue)
}

const readNetworkPublicKey = (
	network: OpsNetwork,
	key: keyof typeof publicKeyEnvKeys,
	env: OpsEnv
): string => {
	const envKey = publicKeyEnvKeys[key]
	const networkEnvKey = `${network.toUpperCase()}_${envKey}`
	const defaultValue = opsDefaults[network][key]
	const globalOverride = network === "mainnet" ? readEnv(env, envKey) : undefined
	return readEnv(env, networkEnvKey) ?? globalOverride ?? defaultValue
}

export const getOpsConfig = (
	networkInput?: unknown,
	env: OpsEnv = defaultEnv()
): OpsEndpointConfig => {
	const network = resolveOpsNetwork(networkInput)
	return {
		network,
		actionsIndexerUrl: readNetworkEndpoint(network, "actionsIndexerUrl", env),
		l1ArchiveUrl: readNetworkEndpoint(network, "l1ArchiveUrl", env),
		l2ArchiveUrl: readNetworkEndpoint(network, "l2ArchiveUrl", env),
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
	endpoint: string
	supportsBestChain: boolean
}): Promise<ServiceProbe> => {
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
		const details = {
			...extractActionsIndexerDetails({ healthPayload, statusPayload }),
			statusHttp
		}

		const status =
			health.response.ok && healthStatus === "healthy" && statusError === undefined
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
			...(healthError || statusError ? { error: healthError ?? statusError } : {})
		}
	} catch (error) {
		return makeProbeError({ id, label, kind: "actions-indexer", endpoint, error })
	}
}

export const readActionsIndexerToken = (
	network: OpsNetwork,
	env: OpsEnv = defaultEnv()
): string | undefined =>
	readEnv(env, `${network.toUpperCase()}_ACTIONS_INDEXER_TOKEN`) ??
	readEnv(env, "ACTIONS_INDEXER_TOKEN")

export const createOpsSnapshot = async (
	networkInput?: unknown,
	env: OpsEnv = defaultEnv()
): Promise<OpsSnapshot> => {
	const config = getOpsConfig(networkInput, env)
	const actionsIndexerRequestUrl = getActionsIndexerRequestUrl(config.network, env)
	const token = readActionsIndexerToken(config.network, env)
	const [indexer, l1Archive, l2Archive, l1Daemon, l2Daemon] = await Promise.all([
		probeActionsIndexer({
			endpoint: config.actionsIndexerUrl,
			requestEndpoint: actionsIndexerRequestUrl,
			token
		}),
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
		throw new Error(
			`${config.network.toUpperCase()}_ACTIONS_INDEXER_TOKEN or ACTIONS_INDEXER_TOKEN is required for indexer control actions`
		)
	}

	const { response } = await timedFetch(
		`${actionsIndexerRequestUrl}/${action}`,
		{
			...indexerRequestInit(token, { method: "POST" })
		},
		{
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
