import { type } from "arktype"

const validateBody = type({
	address: "string.alphanumeric"
})

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return new Response(body.message, { status: 400 })
	const url =
		process.env.FAUCET_URL ??
		useRuntimeConfig(event).faucetUrl ??
		event.context.cloudflare.env.FAUCET_URL
	if (!url) return new Response("Server misconfigured.", { status: 500 })
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body)
	})
	if (!response.ok) return new Response("The internal service is not available.", { status: 502 })
	const result = await response.text()
	if (result.includes("Account_balance_precondition_unsatisfied"))
		return new Response("This address has already claimed tMina tokens.", { status: 403 })
	if (result.includes("Error")) return new Response(result, { status: 400 })
	return new Response(result, { status: 202 })
})
