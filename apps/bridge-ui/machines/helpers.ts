import type { Bridge } from "@zeko-labs/bridge-sdk"
import {
	BRIDGE_UI_CONFIG_BY_ROUTE,
	createExplorerUrl as createNetworkExplorerUrl,
	formatBridgeRoute
} from "@zeko/networks"
import type { BridgeNetwork } from "./networks"

const POLL_TIMEOUT = 3_600_000

export const getBridgeConfig = ({ l1, l2 }: { l1: BridgeNetwork; l2: BridgeNetwork }) => {
	const route = formatBridgeRoute(l1, l2) as keyof typeof BRIDGE_UI_CONFIG_BY_ROUTE
	const config = BRIDGE_UI_CONFIG_BY_ROUTE[route]
	if (config === undefined) throw new Error(`Unsupported bridge UI route: ${l1} -> ${l2}`)

	return {
		...config,
		pollTimeout: POLL_TIMEOUT
	} satisfies Parameters<typeof Bridge.init>[0]
}

export const createExplorerUrl = ({ network, hash }: { network: BridgeNetwork; hash: string }) =>
	createNetworkExplorerUrl(network, hash)
