import type { Config } from "@zeko-labs/bridge-sdk"
import type { RouteDescriptor } from "./routes"

const TESTNET_CONFIG = {
	l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
	l1ArchiveUrl: "https://devnet-archive-node-api.gcp.o1test.net/",
	zekoUrl: "https://alphanet.zeko.io/graphql",
	zekoArchiveUrl: "https://archive.alphanet.zeko.io/graphql",
	// actionsApi: "http://api.actions.zeko.io/graphql",
	actionsApi: "http://localhost:9100/graphql",
	l1Network: "testnet",
	l2Network: "testnet"
} as const satisfies Config

const MAINNET_CONFIG = {
	l1Url: "https://api.minascan.io/node/mainnet/v1/graphql",
	l1ArchiveUrl: "https://api.minascan.io/archive/mainnet/v1/graphql",
	zekoUrl: "https://mainnet.zeko.io/graphql",
	zekoArchiveUrl: "https://archive.mainnet.zeko.io/graphql",
	actionsApi: "https://api.actions.zeko.io/graphql",
	l1Network: "mainnet",
	l2Network: "mainnet"
} as const satisfies Config

export const createSdkConfig = (
	route: RouteDescriptor,
	options: { env?: Partial<Record<string, string | undefined>>; verbose?: boolean } = {}
): Config => {
	if (!route.enabled) {
		throw new Error(route.reason ?? `Bridge route ${route.label} is not enabled.`)
	}

	const env = options.env ?? process.env
	const actionsApi = env.BRIDGE_CLI_ACTIONS_API_URL?.trim()

	if (route.from.includes("testnet") && route.to.includes("testnet")) {
		return {
			...TESTNET_CONFIG,
			...(actionsApi ? { actionsApi } : {}),
			verbose: options.verbose === true
		}
	}

	if (route.from.includes("mainnet") && route.to.includes("mainnet")) {
		return {
			...MAINNET_CONFIG,
			...(actionsApi ? { actionsApi } : {}),
			verbose: options.verbose === true
		}
	}

	throw new Error(`Unsupported network pairing for ${route.label}`)
}
