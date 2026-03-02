import { Container } from "@cloudflare/containers"
import type { FaucetContainerEnv } from "./types"

export class Faucet extends Container<FaucetContainerEnv> {
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
