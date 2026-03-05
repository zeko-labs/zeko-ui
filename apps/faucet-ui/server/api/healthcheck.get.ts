export default defineEventHandler(async (event) => {
	if (import.meta.dev) return new Response("OK", { status: 200 })

	const { env } = event.context.cloudflare
	const faucet = await env.FAUCET.fetch(new Request("https://faucet/healthcheck"))
	if (!faucet.ok) return new Response("The faucet service is not available.", { status: 502 })

	return new Response("OK", { status: 200 })
})
