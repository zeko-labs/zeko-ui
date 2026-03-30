import { type } from "arktype"
import {
	FAUCET_CHAIN,
	type FaucetErrorResponse,
	type FaucetResponse,
	parseFaucetResponse
} from "~~/helpers/validation"
import { getTrustedClientIp, validateBody, verifyTurnstile } from "../utils"

type FaucetTurnstileRpcResult = {
	status: number
	payload: FaucetResponse
}

type FaucetTurnstileRpcBinding = {
	claimWithTurnstile: (input: {
		address: string
		chain: typeof FAUCET_CHAIN
		clientIp: string
	}) => Promise<FaucetTurnstileRpcResult>
}

type FaucetRpcEnv = {
	FAUCET_RPC: FaucetTurnstileRpcBinding
}

const jsonError = (status: number, code: string, message: string) =>
	Response.json(
		{
			success: false,
			code,
			message
		} satisfies FaucetErrorResponse,
		{ status }
	)

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return jsonError(400, "invalid_body", body.message)

	const clientIp = getTrustedClientIp(event)
	if (!clientIp)
		return jsonError(400, "missing_client_ip", "X-Client-IP is required for turnstile requests.")

	console.log(`Faucet request: IP[${clientIp}], Address[${body.address}]`)
	const { env } = event.context.cloudflare

	const isVerified = await verifyTurnstile({
		token: body.cfToken,
		secret: env.TURNSTILE_SECRET_KEY,
		ip: clientIp
	})
	if (!isVerified) {
		console.error("Turnstile verification failed for IP:", clientIp)
		return jsonError(
			403,
			"turnstile_verification_failed",
			"Failed to verify you are human. Please try again."
		)
	}

	// Turnstile is verified in the UI worker, then forwarded via internal Worker RPC only.
	const faucetResult = await (async () => {
		try {
			return await (env as unknown as FaucetRpcEnv).FAUCET_RPC.claimWithTurnstile({
				address: body.address,
				chain: FAUCET_CHAIN,
				clientIp
			})
		} catch (error) {
			console.error("Error calling faucet RPC:", error)
			return null
		}
	})()

	if (!faucetResult)
		return jsonError(502, "invalid_faucet_response", "The faucet service is currently unavailable.")

	const faucetData = parseFaucetResponse(faucetResult.payload)
	if (!faucetData) {
		console.error("Unexpected faucet response payload:", faucetResult.payload)
		return jsonError(
			502,
			"invalid_faucet_response",
			"The faucet service returned an unexpected response."
		)
	}

	if (faucetData.success)
		console.log("Faucet successful response for %s (%s)", body.address, clientIp)

	return Response.json(faucetData, { status: faucetResult.status })
})
