export type DetailValue = string | number | boolean | null

export interface InsightService {
	id: string
	details: Record<string, DetailValue>
}

export interface ChainInsight {
	id: "l1" | "l2"
	label: string
	indexerLabel: string
	indexerHeight: number | null
	indexerFinalHeight: number | null
	archiveHeight: number | null
	archiveCanonicalHeight: number | null
	daemonHeight: number | null
	indexerArchiveLag: number | null
	archiveDaemonGap: number | null
}

export const toNumber = (value: DetailValue | undefined): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : null
	}
	return null
}

export const blockGap = (
	referenceHeight: number | null,
	observedHeight: number | null
): number | null =>
	referenceHeight === null || observedHeight === null ? null : referenceHeight - observedHeight

export const gapState = (gap: number | null): "ok" | "warn" | "error" | "unknown" => {
	if (gap === null) return "unknown"
	const distance = Math.abs(gap)
	if (distance <= 5) return "ok"
	if (distance <= 100) return "warn"
	return "error"
}

export const gapLabel = (gap: number | null, aheadLabel: string, behindLabel: string): string => {
	if (gap === null) return "unavailable"
	if (gap === 0) return "aligned"
	const distance = Math.abs(gap).toLocaleString()
	return gap > 0 ? `${distance} ${behindLabel}` : `${distance} ${aheadLabel}`
}

const detailNumber = (service: InsightService | undefined, key: string): number | null =>
	toNumber(service?.details[key])

export const buildChainInsight = ({
	id,
	label,
	indexerLabel,
	indexer,
	archive,
	daemon,
	indexerHeightKey,
	indexerFinalHeightKey
}: {
	id: "l1" | "l2"
	label: string
	indexerLabel: string
	indexer?: InsightService
	archive?: InsightService
	daemon?: InsightService
	indexerHeightKey: string
	indexerFinalHeightKey: string
}): ChainInsight => {
	const indexerHeight = detailNumber(indexer, indexerHeightKey)
	const indexerFinalHeight = detailNumber(indexer, indexerFinalHeightKey)
	const archiveHeight =
		detailNumber(archive, "pendingMaxBlockHeight") ??
		detailNumber(archive, "canonicalMaxBlockHeight")
	const archiveCanonicalHeight = detailNumber(archive, "canonicalMaxBlockHeight")
	const daemonHeight = detailNumber(daemon, "blockHeight")

	return {
		id,
		label,
		indexerLabel,
		indexerHeight,
		indexerFinalHeight,
		archiveHeight,
		archiveCanonicalHeight,
		daemonHeight,
		indexerArchiveLag: blockGap(archiveHeight, indexerHeight),
		archiveDaemonGap: blockGap(daemonHeight, archiveHeight)
	}
}
