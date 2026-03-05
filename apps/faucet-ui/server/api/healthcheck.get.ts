const SEQUENCER_URL = "https://devnet.zeko.io/graphql"

export default defineEventHandler(async (event) => {
	if (import.meta.dev) return new Response("OK", { status: 200 })

	const { env } = event.context.cloudflare

	const [faucet, sequencer] = await Promise.all([
		env.FAUCET.fetch(new Request("https://faucet/healthcheck")),
		fetch(`${SEQUENCER_URL}?query=${encodeURIComponent("{ networkID }")}`)
	])

	if (!faucet.ok) return new Response("The faucet service is not available.", { status: 502 })
	if (!sequencer.ok) return new Response("The sequencer is not available.", { status: 502 })

	return new Response("OK", { status: 200 })
})
