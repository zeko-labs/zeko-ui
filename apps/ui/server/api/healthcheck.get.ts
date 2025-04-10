export default defineEventHandler(async (event) => {
    const auth = event.web?.request?.headers.get("x-auth-id")
    const url = import.meta.dev ?
        useRuntimeConfig(event).faucetUrl : event.context.cloudflare.env.STORE_FAUCET_URL
    if (!url) return new Response("Service is misconfigured.", { status: 500 })
    if (auth !== url) return new Response("Unauthorized", { status: 401 })
    const response = await fetch(url, {
        method: "http://testnet.zeko.io/graphql?query=query%20%7B%0A%20%20networkID%0A%7D",
        headers: {
            "Content-Type": "application/json"
        }
    })
    if (!response.ok) return new Response("The sequencer is not available.", { status: 502 })
    return new Response("OK", { status: 200 })
})
