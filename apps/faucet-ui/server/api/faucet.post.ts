import { env } from "cloudflare:workers"
import { type } from "arktype"
import { faucetBody } from "~~/helpers/validation"

const validateBody = type({
	address: "string.alphanumeric",
	cfToken: "string"
})

async function verifyTurnstile({
	token,
	remoteip,
	secret
}: { token: string; secret: string; remoteip: string }): Promise<boolean> {
	const verifyEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

	const response = await fetch(verifyEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ secret, response: token, remoteip })
	})

	const data = (await response.json()) as { success: boolean }
	return data.success
}

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return Response.json({ message: body.message }, { status: 400 })
	const clientIP =
		getHeader(event, "cf-connecting-ip") ||
		getHeader(event, "x-forwarded-for") ||
		getHeader(event, "x-real-ip") ||
		""
	const isVerified = await verifyTurnstile({
		token: body.cfToken,
		secret: env.TURNSTILE_SECRET_KEY,
		remoteip: clientIP
	})
	if (!isVerified) {
		return Response.json(
			{ message: "Failed to verify you are human. Please try again." },
			{ status: 403 }
		)
	}
	const request = new Request("https://faucet.com", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ address: body.address })
	})
	//TODO: Figure out how to user service bindings with nitro in dev mode
	const response = import.meta.dev
		? Response.json({ message: "claimed", hash: "test", data: {} })
		: await event.context.cloudflare.env.FAUCET.fetch(request)
	try {
		const faucetResult = await response.json()
		const faucetData = faucetBody(faucetResult)
		if (faucetData instanceof type.errors)
			// This happens if the response doesn't have a .message field
			return Response.json({ message: "An un-expected error has occurred." }, { status: 400 })
		if (faucetData.message.includes("claimed"))
			return Response.json({ message: "This address has already claimed tokens." }, { status: 403 })
		if (faucetData.message.toLocaleLowerCase().includes("error"))
			return Response.json(
				{ message: `An unknown error has occurred: ${faucetData.message}` },
				{ status: 400 }
			)
		return Response.json(faucetData, { status: 202 })
	} catch {
		return Response.json({ message: "The internal service is not available." }, { status: 502 })
	}
})
