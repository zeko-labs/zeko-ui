import { Container, getRandom } from "@cloudflare/containers"

const INSTANCE_COUNT = 3

export class Faucet extends Container<Env> {
	defaultPort = 3000
	sleepAfter = "5m"
	envVars = {
		ZEKO_FAUCET_SENDER_PRIVATE_KEY: this.env.ZEKO_FAUCET_SENDER_PRIVATE_KEY,
		ZEKO_FAUCET_SEND_AMOUNT: this.env.ZEKO_FAUCET_SEND_AMOUNT
	}

	override onStart() {
		console.log("Container successfully started")
	}

	override onStop() {
		console.log("Container successfully shut down")
	}

	override onError(error: unknown) {
		console.log("Container error:", error)
	}
}

const validateBody = (body: unknown): body is { address: string } => {
	return (
		typeof body === "object" &&
		body !== null &&
		"address" in body &&
		typeof body.address === "string" &&
		body.address.length > 0
	)
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			console.log("Incoming request to the Faucet container")
			const body = await request.clone().json()
			if (!validateBody(body))
				return Response.json({ message: "Address cannot be null" }, { status: 400 })
			const { address } = body
			const lastClaim = await env.FAUCET_CLAIM.get(address)
			if (lastClaim)
				return Response.json({ message: `Already claimed at ${lastClaim}` }, { status: 403 })
			// TODO: "getRandom" to be replaced with latency-aware routing in the near future
			const containerInstance = await getRandom(env.FAUCET, INSTANCE_COUNT)
			console.log(`Routing request to container instance: ${containerInstance.id}`)
			const response = await containerInstance.fetch(request)

			const data = await response.clone().json<{ message: string }>()
			console.log(
				`Response Status ${response.status} from container ${containerInstance.id}:`,
				data
			)
			if (data.message === "Successfully sent") {
				ctx.waitUntil(env.FAUCET_CLAIM.put(address, new Date().toISOString()))
				console.log(`Stored claim for address ${address} at ${new Date().toISOString()}`)
			}
			return response
		} catch (error) {
			console.error("Error processing request in Faucet container:", error)
			return Response.json(
				{ message: "An error occurred while processing your request." },
				{ status: 500 }
			)
		}
	}
} satisfies ExportedHandler<Env>
