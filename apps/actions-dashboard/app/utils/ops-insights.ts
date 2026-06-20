export type DetailValue = string | number | boolean | null

export interface InsightService {
	id: string
	details: Record<string, DetailValue>
}

export interface ChainInsight {
	id: "l1" | "l2"
	label: string
	indexerLabel: string
	lastActionBlockHeight: number | null
	finalActionBlockHeight: number | null
	nonCanonicalTailCount: number | null
	actionCoverageStatus: string | null
	actionCoverageError: string | null
	missingActionCount: number | null
	missingActionBlockCount: number | null
	firstMissingActionBlock: number | null
	latestArchiveActionBlock: number | null
	actionScanFrom: number | null
	actionScanTo: number | null
	archiveHeight: number | null
	archiveCanonicalHeight: number | null
	daemonHeight: number | null
	archiveFinalityGap: number | null
	canonicalActionGap: number | null
	lastActionGap: number | null
	archiveDaemonGap: number | null
	expectedFinalityBlocks: number | null
	daemonBlockHeightSupported: boolean
}

type ServiceStatus = "ok" | "warn" | "error" | "unknown"

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

export const databaseAgeSeconds = (service: InsightService | undefined): number | null => {
	const value = detailNumber(service, "databaseAgeMs")
	return value === null ? null : Math.round(value / 1000)
}

const detailString = (service: InsightService | undefined, key: string): string | null => {
	const value = service?.details[key]
	return typeof value === "string" && value.trim() !== "" ? value : null
}

export const finalityState = (
	gap: number | null,
	expectedFinalityBlocks: number | null
): "ok" | "warn" | "error" | "unknown" => {
	if (gap === null) return "unknown"
	if (gap < 0) return "warn"
	if (expectedFinalityBlocks === null) return gapState(gap)
	if (gap <= expectedFinalityBlocks) return "ok"
	if (gap <= expectedFinalityBlocks * 2) return "warn"
	return "error"
}

export const actionGapState = (gap: number | null): "ok" | "warn" | "error" | "unknown" => {
	if (gap === null) return "unknown"
	if (gap <= 0) return "ok"
	return "warn"
}

export const tailState = (
	tailCount: number | null,
	expectedFinalityBlocks: number | null
): ServiceStatus => {
	if (tailCount === null) return "unknown"
	if (expectedFinalityBlocks === null) return gapState(tailCount)
	if (tailCount <= expectedFinalityBlocks) return "ok"
	if (tailCount <= expectedFinalityBlocks * 2) return "warn"
	return "error"
}

const formatBlock = (value: number | null) => (value === null ? "-" : value.toLocaleString())

const hasCanonicalL2FinalityStall = (row: ChainInsight): boolean =>
	row.id === "l2" &&
	row.nonCanonicalTailCount !== null &&
	row.nonCanonicalTailCount > 0 &&
	row.lastActionBlockHeight !== null &&
	row.archiveCanonicalHeight !== null &&
	(row.finalActionBlockHeight === null || row.finalActionBlockHeight < row.lastActionBlockHeight) &&
	row.lastActionBlockHeight <= row.archiveCanonicalHeight

const hasL1DepositFinalityRisk = (row: ChainInsight): boolean =>
	row.id === "l1" &&
	row.nonCanonicalTailCount !== null &&
	row.nonCanonicalTailCount > 0 &&
	row.actionCoverageStatus !== "missing" &&
	row.lastActionBlockHeight !== null &&
	(row.finalActionBlockHeight === null || row.finalActionBlockHeight < row.lastActionBlockHeight)

export const actionFinalityState = (row: ChainInsight): ServiceStatus => {
	if (hasCanonicalL2FinalityStall(row)) return "error"
	if (hasL1DepositFinalityRisk(row)) return "warn"
	return tailState(row.nonCanonicalTailCount, row.expectedFinalityBlocks)
}

export const actionFinalityLabel = (row: ChainInsight): string => {
	if (hasCanonicalL2FinalityStall(row)) {
		const count = row.nonCanonicalTailCount ?? 0
		const unit = count === 1 ? "action" : "actions"
		return `${count.toLocaleString()} canonical ${unit} not finalized in DB`
	}
	if (hasL1DepositFinalityRisk(row)) {
		const count = row.nonCanonicalTailCount ?? 0
		const unit = count === 1 ? "action" : "actions"
		return `${count.toLocaleString()} L1 ${unit} not final; deposits and withdrawals may be blocked`
	}
	if (row.nonCanonicalTailCount === null) return "pending actions unknown"
	if (row.nonCanonicalTailCount === 0) return "no pending actions"
	const unit = row.nonCanonicalTailCount === 1 ? "action" : "actions"
	return `${row.nonCanonicalTailCount.toLocaleString()} ${unit} waiting finality`
}

export const actionFinalityDetail = (row: ChainInsight): string => {
	if (hasCanonicalL2FinalityStall(row))
		return `archive canonical ${formatBlock(row.archiveCanonicalHeight)}; DB final ${formatBlock(row.finalActionBlockHeight)}; indexed ${formatBlock(row.lastActionBlockHeight)}`
	if (hasL1DepositFinalityRisk(row))
		return `DB final ${formatBlock(row.finalActionBlockHeight)}; indexed ${formatBlock(row.lastActionBlockHeight)}; archive canonical ${formatBlock(row.archiveCanonicalHeight)}; archive pending ${formatBlock(row.archiveHeight)}; coverage ${row.actionCoverageStatus ?? "unknown"}`
	return `final action block ${formatBlock(row.finalActionBlockHeight)}`
}

export const buildChainInsight = ({
	id,
	label,
	indexerLabel,
	indexer,
	archive,
	daemon,
	indexerHeightKey,
	indexerFinalHeightKey,
	nonCanonicalTailKey,
	expectedFinalityBlocks,
	daemonBlockHeightSupported
}: {
	id: "l1" | "l2"
	label: string
	indexerLabel: string
	indexer?: InsightService
	archive?: InsightService
	daemon?: InsightService
	indexerHeightKey: string
	indexerFinalHeightKey: string
	nonCanonicalTailKey: string
	expectedFinalityBlocks: number | null
	daemonBlockHeightSupported: boolean
}): ChainInsight => {
	const lastActionBlockHeight = detailNumber(indexer, indexerHeightKey)
	const finalActionBlockHeight = detailNumber(indexer, indexerFinalHeightKey)
	const nonCanonicalTailCount = detailNumber(indexer, nonCanonicalTailKey)
	const detailPrefix = id
	const archiveHeight =
		detailNumber(archive, "pendingMaxBlockHeight") ??
		detailNumber(archive, "canonicalMaxBlockHeight")
	const archiveCanonicalHeight = detailNumber(archive, "canonicalMaxBlockHeight")
	const daemonHeight = daemonBlockHeightSupported ? detailNumber(daemon, "blockHeight") : null

	return {
		id,
		label,
		indexerLabel,
		lastActionBlockHeight,
		finalActionBlockHeight,
		nonCanonicalTailCount,
		actionCoverageStatus: detailString(indexer, `${detailPrefix}ActionCoverageStatus`),
		actionCoverageError: detailString(indexer, `${detailPrefix}ActionCoverageError`),
		missingActionCount: detailNumber(indexer, `${detailPrefix}MissingActionCount`),
		missingActionBlockCount: detailNumber(indexer, `${detailPrefix}MissingActionBlockCount`),
		firstMissingActionBlock: detailNumber(indexer, `${detailPrefix}FirstMissingActionBlock`),
		latestArchiveActionBlock: detailNumber(indexer, `${detailPrefix}LatestArchiveActionBlock`),
		actionScanFrom: detailNumber(indexer, `${detailPrefix}ActionScanFrom`),
		actionScanTo: detailNumber(indexer, `${detailPrefix}ActionScanTo`),
		archiveHeight,
		archiveCanonicalHeight,
		daemonHeight,
		archiveFinalityGap: blockGap(archiveHeight, archiveCanonicalHeight),
		canonicalActionGap: blockGap(archiveCanonicalHeight, finalActionBlockHeight),
		lastActionGap: blockGap(archiveHeight, lastActionBlockHeight),
		archiveDaemonGap: daemonBlockHeightSupported ? blockGap(daemonHeight, archiveHeight) : null,
		expectedFinalityBlocks,
		daemonBlockHeightSupported
	}
}
