import { formatBridgeRoute, MINA_NETWORKS, ZEKO_M_NETWORKS } from "@zeko/networks"

export type BridgeValidatorRouteKey = "mina-to-zeko" | "zeko-to-mina"
type ValidatorChain = typeof MINA_NETWORKS.testnet | typeof ZEKO_M_NETWORKS.testnet

export type BridgeValidatorRoute = {
	key: BridgeValidatorRouteKey
	from: ValidatorChain
	to: ValidatorChain
	route: `${ValidatorChain}->${ValidatorChain}`
	direction: "deposit" | "withdrawal"
}

export const validatorRoutes = {
	minaToZeko: {
		key: "mina-to-zeko",
		from: MINA_NETWORKS.testnet,
		to: ZEKO_M_NETWORKS.testnet,
		route: formatBridgeRoute(MINA_NETWORKS.testnet, ZEKO_M_NETWORKS.testnet),
		direction: "deposit"
	},
	zekoToMina: {
		key: "zeko-to-mina",
		from: ZEKO_M_NETWORKS.testnet,
		to: MINA_NETWORKS.testnet,
		route: formatBridgeRoute(ZEKO_M_NETWORKS.testnet, MINA_NETWORKS.testnet),
		direction: "withdrawal"
	}
} satisfies Record<string, BridgeValidatorRoute>

export const validatorRouteAmounts = {
	[validatorRoutes.minaToZeko.key]: "2",
	[validatorRoutes.zekoToMina.key]: "2"
} satisfies Record<BridgeValidatorRouteKey, string>

export const validatorRouteKeys = [
	validatorRoutes.minaToZeko.key,
	validatorRoutes.zekoToMina.key
] as const satisfies readonly BridgeValidatorRouteKey[]

export const validatorRoutesByKey = {
	[validatorRoutes.minaToZeko.key]: validatorRoutes.minaToZeko,
	[validatorRoutes.zekoToMina.key]: validatorRoutes.zekoToMina
} satisfies Record<BridgeValidatorRouteKey, BridgeValidatorRoute>

export const getValidatorRoute = (routeKey: BridgeValidatorRouteKey): BridgeValidatorRoute =>
	validatorRoutesByKey[routeKey]

export const getValidatorRouteAmount = (routeKey: BridgeValidatorRouteKey) =>
	validatorRouteAmounts[routeKey]
