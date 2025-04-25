import { env } from "cloudflare:workers"

export default defineEventHandler(async (event) => {
	const auth = event.headers.get("Authorization")
	const url = import.meta.dev ? useRuntimeConfig(event).faucetUrl : await env.STORE_FAUCET_URL.get()
	if (!url) return new Response("Service is misconfigured.", { status: 500 })
	if (auth !== url) return new Response(`Unauthorized header: ${auth}`, { status: 401 })
	const sequencer = await fetch(
		"http://testnet.zeko.io/graphql?query=query%20%7B%0A%20%20networkID%0A%7D",
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json"
			}
		}
	)
	if (!sequencer.ok) return new Response("The sequencer is not available.", { status: 502 })
	const faucet = await fetch(`${url}healthcheck`)
	if (!faucet.ok) return new Response("The faucet is not available.", { status: 502 })
	return new Response("OK", { status: 200 })
})
