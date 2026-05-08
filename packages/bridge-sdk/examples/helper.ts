import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { env } from "node:process"
import { PrivateKey } from "o1js"
import type { Config } from "../src/index"

export const readEnv = (key: string, fallback: string): string => env[key]?.trim() || fallback

export const readBridgeConfig = (): Config => ({
	l1Url: readEnv("L1_URL", "https://api.minascan.io/node/devnet/v1/graphql"),
	l1ArchiveUrl: readEnv("L1_ARCHIVE_URL", "https://api.minascan.io/archive/devnet/v1/graphql"),
	actionsApi: readEnv("ACTIONS_API_URL", "https://api.actions.zeko.io/graphql"),
	zekoUrl: readEnv("L2_URL", "https://testnet.zeko.io/graphql"),
	zekoArchiveUrl: readEnv("L2_ARCHIVE_URL", "https://archive.testnet.zeko.io/graphql"),
	l1Network: "testnet",
	l2Network: "testnet"
})

export const readMinaPrivateKey = (): PrivateKey => {
	const privateKey = readEnv("MINA_PRIVATE_KEY", "")
	if (!privateKey) {
		throw new Error("MINA_PRIVATE_KEY is not set")
	}

	return PrivateKey.fromBase58(privateKey)
}

export const writeLog = ({ log, name }: { log: object; name: string }) => {
	try {
		const tmpDir = join(process.cwd(), "tmp")
		mkdirSync(tmpDir, { recursive: true })
		const logPath = join(tmpDir, `${name}-${Date.now()}.log`)
		writeFileSync(logPath, JSON.stringify(log, null, 2), "utf8")
		console.log(`${name} log written to ${logPath}`)
	} catch (e) {
		console.error("Failed to write log:", e)
	}
}
