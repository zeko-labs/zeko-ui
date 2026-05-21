import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { env } from "node:process"
import { PrivateKey, type NetworkId } from "o1js"
import type { Config } from "../src/index"

export const readEnv = (key: string, fallback: string): string => env[key]?.trim() || fallback

type BridgeNetworkId = Extract<NetworkId, "testnet" | "mainnet">

const NETWORK_IDS = ["testnet", "mainnet"] as const satisfies readonly BridgeNetworkId[]

const readNetworkId = (key: string, fallback: BridgeNetworkId): BridgeNetworkId => {
	const value = readEnv(key, fallback)
	if (NETWORK_IDS.includes(value as BridgeNetworkId)) return value as BridgeNetworkId
	throw new Error(`${key} must be one of: ${NETWORK_IDS.join(", ")}`)
}

const defaultActionsApiForNetwork = (network: BridgeNetworkId): string =>
	network === "mainnet"
		? "https://api.actions.zeko.io/graphql"
		: "https://testnet.api.actions.zeko.io/graphql"

const defaultL1UrlForNetwork = (network: BridgeNetworkId): string =>
	network === "mainnet"
		? "https://api.minascan.io/node/mainnet/v1/graphql"
		: "https://gateway.mina.devnet.zeko.io"

const defaultL1ArchiveUrlForNetwork = (network: BridgeNetworkId): string =>
	network === "mainnet"
		? "https://api.minascan.io/archive/mainnet/v1/graphql"
		: "https://gateway.mina.archive.devnet.zeko.io"

const defaultL2UrlForNetwork = (network: BridgeNetworkId): string =>
	network === "mainnet" ? "https://mainnet.zeko.io/graphql" : "https://testnet.zeko.io/graphql"

const defaultL2ArchiveUrlForNetwork = (network: BridgeNetworkId): string =>
	network === "mainnet"
		? "https://archive.mainnet.zeko.io/graphql"
		: "https://archive.testnet.zeko.io/graphql"

export const readBridgeConfig = (): Config => {
	const l1Network = readNetworkId("L1_NETWORK", "testnet")
	const l2Network = readNetworkId("L2_NETWORK", "testnet")

	return {
		l1Url: readEnv("L1_URL", defaultL1UrlForNetwork(l1Network)),
		l1ArchiveUrl: readEnv("L1_ARCHIVE_URL", defaultL1ArchiveUrlForNetwork(l1Network)),
		actionsApi: readEnv("ACTIONS_API_URL", defaultActionsApiForNetwork(l2Network)),
		zekoUrl: readEnv("L2_URL", defaultL2UrlForNetwork(l2Network)),
		zekoArchiveUrl: readEnv("L2_ARCHIVE_URL", defaultL2ArchiveUrlForNetwork(l2Network)),
		l1Network,
		l2Network
	}
}

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
