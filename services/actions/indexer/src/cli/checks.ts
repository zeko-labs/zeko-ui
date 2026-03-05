import { createGraphqlClient } from "@zeko/bridge-sdk"
import { fetchActionsQuery, networkStateQuery } from "@zeko/graphql/mina-archive"

export interface HealthCheckResult {
	statusCode: number
	latencyMs: number
	payload: unknown
}

export interface SyncCheckResult {
	outer: {
		lastFetchedBlock: number
		tip: number
		lag: number
		hasPendingActions: boolean
		status: "ok" | "behind"
	}
	inner: {
		lastFetchedBlock: number
		tip: number
		lag: number
		hasPendingActions: boolean
		status: "ok" | "behind"
	}
}

const withTimeout = async <T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string
): Promise<T> => {
	const timeout = new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
	})
	return Promise.race([promise, timeout])
}

const normalizeUrl = (url: string): string => url.replace(/\/+$/, "")

export async function runHealthCheck({
	baseUrl,
	timeoutMs
}: {
	baseUrl: string
	timeoutMs: number
}): Promise<HealthCheckResult> {
	const start = Date.now()
	const response = await withTimeout(
		fetch(`${normalizeUrl(baseUrl)}/health`),
		timeoutMs,
		"health request"
	)
	const text = await response.text()
	let payload: unknown = text
	try {
		payload = JSON.parse(text)
	} catch {
		// Keep plain text payload for diagnostics.
	}

	return {
		statusCode: response.status,
		latencyMs: Date.now() - start,
		payload
	}
}

const readTip = async (archiveUrl: string, label: string): Promise<number> => {
	const client = createGraphqlClient(archiveUrl, `${label}-archive`)
	const result = await client().query(networkStateQuery, {})
	if (result.error) throw new Error(`${label} tip query failed: ${String(result.error)}`)
	return result.data?.networkState?.maxBlockHeight?.pendingMaxBlockHeight ?? 0
}

const hasPendingActions = async ({
	archiveUrl,
	pk,
	from,
	to,
	label
}: {
	archiveUrl: string
	pk: string
	from: number
	to: number
	label: string
}): Promise<boolean> => {
	if (from > to) return false
	const client = createGraphqlClient(archiveUrl, `${label}-archive`)
	const result = await client().query(fetchActionsQuery, { pk, from, to: to + 1 })
	if (result.error) throw new Error(`${label} actions query failed: ${String(result.error)}`)
	const actions = (result.data?.actions ?? []).filter((item) => item != null)
	return actions.length > 0
}

const readLastFetched = (payload: unknown, key: "outer" | "inner"): number => {
	const value = (payload as { indexer?: { lastFetchedBlock?: { outer?: number; inner?: number } } })
		.indexer?.lastFetchedBlock?.[key]
	const output = Number(value)
	if (!Number.isFinite(output)) {
		throw new Error(`health payload is missing indexer.lastFetchedBlock.${key}`)
	}
	return output
}

export async function runSyncCheck({
	baseUrl,
	timeoutMs,
	l1ArchiveUrl,
	l2ArchiveUrl,
	outerPk,
	innerPk
}: {
	baseUrl: string
	timeoutMs: number
	l1ArchiveUrl: string
	l2ArchiveUrl: string
	outerPk: string
	innerPk: string
}): Promise<SyncCheckResult> {
	const health = await runHealthCheck({ baseUrl, timeoutMs })
	const outerLastFetchedBlock = readLastFetched(health.payload, "outer")
	const innerLastFetchedBlock = readLastFetched(health.payload, "inner")

	const [outerTip, innerTip] = await Promise.all([
		readTip(l1ArchiveUrl, "outer"),
		readTip(l2ArchiveUrl, "inner")
	])

	const [outerPending, innerPending] = await Promise.all([
		hasPendingActions({
			archiveUrl: l1ArchiveUrl,
			pk: outerPk,
			from: outerLastFetchedBlock + 1,
			to: outerTip,
			label: "outer"
		}),
		hasPendingActions({
			archiveUrl: l2ArchiveUrl,
			pk: innerPk,
			from: innerLastFetchedBlock + 1,
			to: innerTip,
			label: "inner"
		})
	])

	const outerLag = Math.max(0, outerTip - outerLastFetchedBlock)
	const innerLag = Math.max(0, innerTip - innerLastFetchedBlock)

	return {
		outer: {
			lastFetchedBlock: outerLastFetchedBlock,
			tip: outerTip,
			lag: outerLag,
			hasPendingActions: outerPending,
			status: outerPending ? "behind" : "ok"
		},
		inner: {
			lastFetchedBlock: innerLastFetchedBlock,
			tip: innerTip,
			lag: innerLag,
			hasPendingActions: innerPending,
			status: innerPending ? "behind" : "ok"
		}
	}
}
