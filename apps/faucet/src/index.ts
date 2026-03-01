import { Hono } from "hono"
import { Mina, PrivateKey } from "o1js"
import { sequencerBaseUrl } from "./constants"
import { sendPayment } from "./faucet"

if (!process.env.ZEKO_FAUCET_SENDER_PRIVATE_KEY)
	throw new Error("set ZEKO_FAUCET_SENDER_PRIVATE_KEY")
if (!process.env.ZEKO_FAUCET_SEND_AMOUNT) throw new Error("set ZEKO_FAUCET_SEND_AMOUNT")

const privateKey = PrivateKey.fromBase58(process.env.ZEKO_FAUCET_SENDER_PRIVATE_KEY)
const publicKey = privateKey.toPublicKey()
const amount = BigInt(process.env.ZEKO_FAUCET_SEND_AMOUNT)

const network = Mina.Network(sequencerBaseUrl)
Mina.setActiveInstance(network)

const app = new Hono()

app.post("/", async (c) => {
	try {
		const { address } = await c.req.json<{ address: string }>()
		if (!address) return c.json({ message: "Address cannot be null" }, 400)
		const result = await sendPayment({ address, privateKey, amount, publicKey })
		return c.json({ success: true, data: result.data, hash: result.hash }, 200)
	} catch (error) {
		console.error(error)
		return c.json({ success: false, message: error instanceof Error ? error.message : error }, 400)
	}
})

app.all("*", (c) => {
	console.log("Unhandled request:", c.req.method, c.req.url)
	return c.json(JSON.stringify(c.req), 404)
})

export default app
