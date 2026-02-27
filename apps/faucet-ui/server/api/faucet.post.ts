import { type } from "arktype"
import { FAUCET_CHAIN, type FaucetErrorResponse, parseFaucetResponse } from "~~/helpers/validation"
import { getTrustedClientIp, validateBody, verifyTurnstile } from "../utils"

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

	const response = await env.FAUCET.fetch("https://faucet.internal/claim", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Auth-Method": "turnstile",
			"X-Client-IP": clientIp
		},
		body: JSON.stringify({ address: body.address, chain: FAUCET_CHAIN })
	})

	const faucetResult = await response
		.clone()
		.json()
		.catch(async (error) => {
			console.error("Error processing faucet response:", error)
			console.error("Response status:", response.status)
			console.error("Response body:", await response.text().catch(() => "<unable to read body>"))
			return null
		})

	if (faucetResult === null)
		return jsonError(502, "invalid_faucet_response", "The faucet service is currently unavailable.")

	const faucetData = parseFaucetResponse(faucetResult)
	if (!faucetData) {
		console.error("Unexpected faucet response payload:", faucetResult)
		return jsonError(
			502,
			"invalid_faucet_response",
			"The faucet service returned an unexpected response."
		)
	}

	if (faucetData.success)
		console.log("Faucet successful response for %s (%s)", body.address, clientIp)

	return Response.json(faucetData, { status: response.status })
})
