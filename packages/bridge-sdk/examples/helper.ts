import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { env } from "node:process"
import { PrivateKey, type NetworkId } from "o1js"
import type { Config } from "../src/index"

type SupportedNetworkId = Extract<NetworkId, "testnet" | "mainnet">

const SUPPORTED_NETWORK_IDS = [
	"testnet",
	"mainnet"
] as const satisfies readonly SupportedNetworkId[]

export const readEnv = (key: string, fallback: string): string => env[key]?.trim() || fallback

export const readNetworkId = (key: string, fallback: SupportedNetworkId): SupportedNetworkId => {
	const value = readEnv(key, fallback)
	if (SUPPORTED_NETWORK_IDS.includes(value as SupportedNetworkId)) {
		return value as SupportedNetworkId
	}

	throw new Error(`${key} must be one of: ${SUPPORTED_NETWORK_IDS.join(", ")}`)
}

export const readBridgeConfig = (): Config => ({
	l1Url: readEnv("L1_URL", "https://gateway.mina.devnet.zeko.io"),
	l1ArchiveUrl: readEnv("L1_ARCHIVE_URL", "https://gateway.mina.archive.devnet.zeko.io"),
	actionsApi: readEnv("ACTIONS_API_URL", "https://api.actions.zeko.io/graphql"),
	zekoUrl: readEnv("L2_URL", "https://testnet.zeko.io/graphql"),
	zekoArchiveUrl: readEnv("L2_ARCHIVE_URL", "https://archive.testnet.zeko.io/graphql"),
	l1Network: readNetworkId("L1_NETWORK", "testnet"),
	l2Network: readNetworkId("L2_NETWORK", "testnet")
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
