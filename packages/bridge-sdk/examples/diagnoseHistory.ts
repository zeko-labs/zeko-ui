import { env } from "node:process"
import { diagnoseBridgeHistory } from "../src/diagnostics"
import { readBridgeConfig, writeLog } from "./helper"

async function main() {
	const walletAddress = env.WALLET_ADDRESS
	if (!walletAddress) {
		throw new Error("WALLET_ADDRESS is not set")
	}

	const diagnostics = await diagnoseBridgeHistory({
		walletAddress,
		config: readBridgeConfig()
	})

	console.log(JSON.stringify(diagnostics, null, 2))
	writeLog({ log: diagnostics, name: "bridge-history-diagnostics" })
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
