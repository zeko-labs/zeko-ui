import { env } from "cloudflare:workers"
import { type } from "arktype"
import { faucetBody } from "~~/helpers/validation"

const validateBody = type({
	address: "string.alphanumeric"
})

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return Response.json({ message: body.message }, { status: 400 })
	const url = import.meta.dev ? useRuntimeConfig(event).faucetUrl : await env.STORE_FAUCET_URL.get()
	if (!url) return Response.json({ message: "A server error has happened." }, { status: 500 })
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body)
	})
	try {
		const faucetResult = await response.json()
		const faucetData = faucetBody(faucetResult)
		if (faucetData instanceof type.errors)
			return Response.json({ message: "The faucet has errored." }, { status: 400 })
		if (faucetData.message.includes("Account_balance_precondition_unsatisfied"))
			return Response.json({ message: "This address has already claimed tokens." }, { status: 403 })
		if (faucetData.message.toLocaleLowerCase().includes("error"))
			return Response.json({ message: "An unknown error occurred." }, { status: 400 })
		return Response.json(faucetData, { status: 202 })
	} catch {
		return Response.json({ message: "The internal service is not available." }, { status: 502 })
	}
})
