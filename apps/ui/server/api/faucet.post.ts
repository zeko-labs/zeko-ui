import { env } from "cloudflare:workers"
import { type } from "arktype"

const validateBody = type({
	address: "string.alphanumeric"
})

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return new Response(body.message, { status: 400 })
	const url = import.meta.dev ?
		useRuntimeConfig(event).faucetUrl : await env.STORE_FAUCET_URL.get()
	if (!url) return new Response("A server error has happened.", { status: 500 })
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body)
	})
	try {
		const result = await response.text()
		if (result.includes("Account_balance_precondition_unsatisfied"))
			return new Response("This address has already claimed tokens.", { status: 403 })
		if (result.includes("Error")) return new Response("An unknown error occurred.", { status: 400 })
		return new Response(result, { status: 202 })
	} catch {
		return new Response("The internal service is not available.", { status: 502 })
	}
})
