import { CLAIM_AMOUNT, getExplorerUrl } from "./constants"
import type { ClaimResult, ErrorResponse, ParsedClaimRequest, SuccessResponse } from "./types"

export const jsonError = (status: number, code: string, message: string, headers?: HeadersInit) =>
	Response.json(
		{
			success: false,
			code,
			message
		} satisfies ErrorResponse,
		{
			status,
			headers
		}
	)

export const jsonSuccess = (status: number, payload: SuccessResponse) =>
	Response.json(payload, { status })

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

export const isClaimResult = (value: unknown): value is ClaimResult =>
	isRecord(value) && typeof value.status === "number" && isRecord(value.payload)

export const toClaimError = (status: number, code: string, message: string): ClaimResult => ({
	status,
	payload: {
		success: false,
		code,
		message
	}
})

export const toClaimSuccess = (body: ParsedClaimRequest, hash: string): ClaimResult => ({
	status: 202,
	payload: {
		success: true,
		hash,
		amount: CLAIM_AMOUNT,
		address: body.address,
		chain: body.chain,
		explorer_url: getExplorerUrl(hash)
	}
})

export const claimResultToResponse = ({ status, payload }: ClaimResult) =>
	payload.success ? jsonSuccess(status, payload) : jsonError(status, payload.code, payload.message)
