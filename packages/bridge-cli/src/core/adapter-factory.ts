import type { BridgeAdapter } from "./adapter"
import { resolveRoute, type ChainRef } from "./routes"

export type BridgeAdapterFactory = (input: {
	from: ChainRef
	to: ChainRef
	verbose: boolean
	actionsApi?: string
}) => Promise<BridgeAdapter> | BridgeAdapter

export const createDefaultBridgeAdapter: BridgeAdapterFactory = async ({
	from,
	to,
	verbose,
	actionsApi
}) => {
	const { createBridgeAdapter } = await import("./adapter")
	return createBridgeAdapter({ route: resolveRoute(from, to), verbose, actionsApi })
}
