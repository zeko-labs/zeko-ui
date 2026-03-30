const SEQUENCER_URL = "https://testnet.zeko.io/graphql"

export default defineEventHandler(async (event) => {
	if (import.meta.dev) return new Response("OK", { status: 200 })

	const { env } = event.context.cloudflare

	const [faucet, sequencer] = await Promise.all([
		env.FAUCET.fetch(new Request("https://faucet/healthcheck")),
		fetch(`${SEQUENCER_URL}?query=${encodeURIComponent("{ networkID }")}`)
	])

	const errors: string[] = []
	if (!faucet.ok) errors.push(`Faucet worker is down (HTTP ${faucet.status})`)
	if (!sequencer.ok) errors.push(`Sequencer is down (HTTP ${sequencer.status})`)

	if (errors.length > 0) return new Response(`${errors.join(". ")}.`, { status: 502 })

	return new Response("OK", { status: 200 })
})
