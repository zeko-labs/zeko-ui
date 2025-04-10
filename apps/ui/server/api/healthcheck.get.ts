import { env } from "cloudflare:workers"

export default defineEventHandler(async (event) => {
    const auth = event.headers.get("Authorization")
    const url = import.meta.dev ?
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        useRuntimeConfig(event).faucetUrl : await (env as any).STORE_FAUCET_URL.get()
    if (!url) return new Response("Service is misconfigured.", { status: 500 })
    if (auth !== url) return new Response(`Unauthorized header: ${auth}`, { status: 401 })
    const response = await fetch(url, {
        method: "http://testnet.zeko.io/graphql?query=query%20%7B%0A%20%20networkID%0A%7D",
        headers: {
            "Content-Type": "application/json"
        }
    })
    if (!response.ok) return new Response("The sequencer is not available.", { status: 502 })
    return new Response("OK", { status: 200 })
})
