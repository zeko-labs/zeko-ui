import { type } from "arktype"
import { faucetBody } from "~~/helpers/validation"

const validateBody = type({ address: "string.alphanumeric", cfToken: "string" })

async function verifyTurnstile({
	token,
	ip,
	secret
}: { token: string; secret: string; ip: string }): Promise<boolean> {
	try {
		const verifyEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

		const response = await fetch(verifyEndpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ secret, response: token, remoteip: ip })
		})

		const data = (await response.json()) as { success: boolean }
		if (data.success) return true
		console.error("Turnstile verification response:", data)
		return false
	} catch (error) {
		console.error("Error verifying Turnstile token:", error)
		return false
	}
}

export default defineEventHandler(async (event) => {
	// Validate body
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return Response.json({ message: body.message }, { status: 400 })

	const ip =
		getHeader(event, "cf-connecting-ip") ||
		getHeader(event, "x-forwarded-for") ||
		getHeader(event, "x-real-ip") ||
		"unknown"

	const { env } = event.context.cloudflare

	// Verify Turnstile
	const isVerified = await verifyTurnstile({
		token: body.cfToken,
		secret: env.TURNSTILE_SECRET_KEY,
		ip
	})

	if (!isVerified) {
		console.error("Turnstile verification failed for IP:", ip)
		return Response.json(
			{ message: "Failed to verify you are human. Please try again." },
			{ status: 403 }
		)
	}

	// IP rate limiting
	const { success } = await env.RATE_LIMIT_FAUCET.limit({ key: ip })
	if (!success) {
		return Response.json(
			{ message: "Too many requests from this IP address. Please try again later." },
			{ status: 429 }
		)
	}

	// Call Faucet Service
	const response = await env.FAUCET.fetch("https://faucet.com/", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ address: body.address })
	})
	try {
		const faucetResult = await response.clone().json()
		const faucetData = faucetBody(faucetResult)
		// Response doesn't have a .message field
		if (faucetData instanceof type.errors)
			return Response.json({ message: "An unexpected error has occurred." }, { status: 400 })

		// Already claimed
		if (faucetData.message.includes("claimed"))
			return Response.json({ message: "This address has already claimed tokens." }, { status: 403 })

		// Sequencer down (502)
		if (faucetData.message.includes("sequencer is currently unavailable"))
			return Response.json(
				{ message: "The Zeko Sequencer is currently unavailable. Please try again later." },
				{ status: 503 }
			)

		// Other errors
		if (faucetData.message.toLowerCase().includes("error")) {
			console.error("Faucet service returned an error message:", faucetData.message)
			return Response.json({ message: faucetData.message }, { status: 400 })
		}

		console.log("Faucet successful response")
		return Response.json(faucetData, { status: 202 })
	} catch (error) {
		console.error("Error processing faucet response:", error)
		console.error("Response status:", response.status)
		console.error("Response body:", await response.text().catch(() => "<unable to read body>"))
		return Response.json(
			{ message: "The faucet service is currently unavailable." },
			{ status: 502 }
		)
	}
})
