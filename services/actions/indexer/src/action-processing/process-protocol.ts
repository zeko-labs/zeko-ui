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
