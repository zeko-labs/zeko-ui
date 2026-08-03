type CanonicalProgressStream = {
	lastFinalIndex: number | null
	lastFinalBlockHeight: number | null
	nonCanonicalTailCount: number
}

export type IndexerCliStatus = {
	isRunning: boolean
	lastRunTimestamp: number | null
	lastFetchedBlock: {
		outer: number | null
		inner: number | null
		registry: number | null
	}
	canonicalProgress?: {
		outer: CanonicalProgressStream
		inner: CanonicalProgressStream
	}
	config: {
		intervalSeconds: number
	}
	consecutiveErrors: number
}

export const indexerStatusFields = (status?: IndexerCliStatus) => ({
	isRunning: status?.isRunning ?? null,
	lastRunTimestamp: status?.lastRunTimestamp ?? null,
	lastFetchedOuter: status?.lastFetchedBlock.outer ?? null,
	lastFetchedInner: status?.lastFetchedBlock.inner ?? null,
	lastFetchedRegistry: status?.lastFetchedBlock.registry ?? null,
	outerLastFinalIndex: status?.canonicalProgress?.outer.lastFinalIndex ?? null,
	outerLastFinalBlock: status?.canonicalProgress?.outer.lastFinalBlockHeight ?? null,
	outerNonCanonicalTail: status?.canonicalProgress?.outer.nonCanonicalTailCount ?? null,
	innerLastFinalIndex: status?.canonicalProgress?.inner.lastFinalIndex ?? null,
	innerLastFinalBlock: status?.canonicalProgress?.inner.lastFinalBlockHeight ?? null,
	innerNonCanonicalTail: status?.canonicalProgress?.inner.nonCanonicalTailCount ?? null,
	intervalSeconds: status?.config.intervalSeconds ?? null,
	consecutiveErrors: status?.consecutiveErrors ?? null
})
