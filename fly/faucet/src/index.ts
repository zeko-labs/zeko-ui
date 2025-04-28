import { Hono } from "hono"
import { sequencerBaseUrl } from "./constants"
import { sendPayment } from "./faucet"

const app = new Hono()

app.get("/healthcheck", async (c) => {
	const response = await fetch(`${sequencerBaseUrl}?query=query%20%7B%0A%20%20networkID%0A%7D`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	})
	if (!response.ok) return c.text("The sequencer is not available.", 502)
	return c.text("OK", 200)
})

app.post("/", async (c) => {
	try {
		const { address } = await c.req.json<{ address: string }>()
		if (!address) return c.text("Address cannot be null", 400)
		const result = await sendPayment(address)
		return c.json({ message: "Successfully sent", data: result.data, hash: result.hash }, 200)
	} catch (error) {
		console.error(error)
		return c.json({ message: `An error has occurred ${error instanceof Error ? error.message : error}` }, 400)
	}
})

export default app