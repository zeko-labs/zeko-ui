import { type } from "arktype"
import { faucetBody } from "~~/helpers/validation"

const validateBody = type({
	address: "string.alphanumeric"
})

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, validateBody)
	if (body instanceof type.errors) return Response.json({ message: body.message }, { status: 400 })
	const request = new Request("https://faucet.com", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
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
