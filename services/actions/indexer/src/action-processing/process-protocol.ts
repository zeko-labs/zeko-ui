import * as v from "valibot"
import type { ActionProcessingResult, ArchiveAction } from "./types"

export interface ProcessRequest {
	blocks: ArchiveAction[]
}

export interface ProcessSuccessResponse {
	ok: true
	result: ActionProcessingResult
}

export interface ProcessErrorResponse {
	ok: false
	error: string
}

export type ProcessResponse = ProcessSuccessResponse | ProcessErrorResponse

const ArchiveActionSchema = v.object({
	blockInfo: v.object({
		timestamp: v.string(),
		height: v.number(),
		distanceFromMaxBlockHeight: v.number()
	}),
	actionState: v.object({
		actionStateOne: v.string(),
		actionStateTwo: v.string()
	}),
	actionData: v.array(
		v.object({
			data: v.array(v.string()),
			transactionInfo: v.object({
				hash: v.string()
			})
		})
	)
})

export const ProcessRequestSchema = v.object({
	blocks: v.array(ArchiveActionSchema)
})

const ActionProcessingStatsSchema = v.object({
	strategy: v.picklist(["main", "worker"]),
	totalMs: v.number(),
	hashingMs: v.number(),
	validationMs: v.number(),
	blocks: v.number(),
	events: v.number(),
	bottleneck: v.picklist(["hashing", "validation"])
})

const ArchiveEventSchema = v.object({
	action: v.array(v.string()),
	beforeActionState: v.string(),
	afterActionState: v.string(),
	timestamp: v.string(),
	hash: v.string(),
	blockInfo: v.object({
		timestamp: v.string(),
		height: v.number(),
		distanceFromMaxBlockHeight: v.number()
	})
})

const ActionProcessingResultSchema = v.object({
	events: v.array(ArchiveEventSchema),
	stats: ActionProcessingStatsSchema
})

export const ProcessResponseSchema = v.variant("ok", [
	v.object({
		ok: v.literal(true),
		result: ActionProcessingResultSchema
	}),
	v.object({
		ok: v.literal(false),
		error: v.string()
	})
])
