import { type } from "arktype"
import { faucetBody } from "~~/helpers/validation"
import { getSpamState, validateBody, verifyTurnstile } from "../utils"

export default defineEventHandler(async (event) => {
	// Validate body
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return Response.json({ message: body.message }, { status: 400 })

	const ip =
		getHeader(event, "cf-connecting-ip") ||
		getHeader(event, "x-forwarded-for") ||
		getHeader(event, "x-real-ip") ||
		"unknown"
	console.log(`Faucet request: IP[${ip}], Address[${body.address}]`)
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
		console.warn("IP rate limit blocked", ip)
		return Response.json(
			{ message: "Too many requests from this IP address. Please try again later." },
			{ status: 429 }
		)
	}

	// IP Ban
	const banned = await env.FAUCET_BANNED_IPS.get(ip)
	if (banned) {
		console.warn("Blocked request from banned IP", ip)
		return Response.json(
			{ message: "Your IP address has been temporarily blocked due to abuse." },
			{ status: 403 }
		)
	}

	// Spam
	const { spam, spamThreshold, spamWindow } = await getSpamState({ ip, env })
	if (spam > spamThreshold) {
		const banTtl = Number.parseInt(env.BAN_TTL_SECONDS ?? String(60 * 60 * 24), 10) //24 hours
		await env.FAUCET_BANNED_IPS.put(ip, new Date().toISOString(), { expirationTtl: banTtl })
		console.warn(
			`Auto-banned IP ${ip} for exceeding ${spamThreshold} requests in the last ${spamWindow} seconds`
		)
		return Response.json(
			{ message: "Your IP address has been temporarily blocked due to abuse." },
			{ status: 403 }
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
		if (faucetData.message.includes("claimed")) {
			console.warn("Address already claimed", body.address)
			return Response.json({ message: "This address has already claimed tokens." }, { status: 403 })
		}

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

		console.log("Faucet successful response for %s (%s)", body.address, ip)
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
