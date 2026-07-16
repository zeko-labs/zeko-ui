export interface ArchiveActionData {
	accountUpdateId?: string
	data: string[]
	transactionInfo: { hash: string }
}

export interface ArchiveAction {
	blockInfo: {
		timestamp: string
		height: number
		distanceFromMaxBlockHeight: number
		chainStatus: string
	}
	actionState: { actionStateOne: string; actionStateTwo: string }
	actionData: ArchiveActionData[]
}

export interface ArchiveEvent {
	accountUpdateId?: string
	action: string[]
	beforeActionState: string
	afterActionState: string
	timestamp: string
	hash: string
	blockInfo: {
		timestamp: string
		height: number
		distanceFromMaxBlockHeight: number
		chainStatus: string
	}
}

export interface ActionProcessingStats {
	strategy: "main" | "worker"
	totalMs: number
	hashingMs: number
	validationMs: number
	blocks: number
	events: number
	bottleneck: "hashing" | "validation"
}

export interface ActionProcessingResult {
	events: ArchiveEvent[]
	stats: ActionProcessingStats
}
