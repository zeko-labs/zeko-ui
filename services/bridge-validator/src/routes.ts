import {
	formatBridgeRoute,
	LEGACY_ZEKO_M_NETWORKS,
	MINA_NETWORKS,
	ZEKO_M_NETWORKS,
	type LegacyZekoMNetwork
} from "@zeko/networks"

export type BridgeValidatorRouteKey = "mina-to-zeko" | "zeko-to-mina"
type ValidatorChain = typeof MINA_NETWORKS.testnet | typeof ZEKO_M_NETWORKS.testnet
type ValidatorCliChain = typeof MINA_NETWORKS.testnet | LegacyZekoMNetwork

export type BridgeValidatorRoute = {
	key: BridgeValidatorRouteKey
	from: ValidatorChain
	to: ValidatorChain
	route: `${ValidatorChain}->${ValidatorChain}`
	cliFrom?: ValidatorCliChain
	cliTo?: ValidatorCliChain
	acceptedResultRoutes?: readonly string[]
	direction: "deposit" | "withdrawal"
}

const validatorRoute = ({
	key,
	from,
	to,
	cliFrom,
	cliTo,
	direction
}: Omit<BridgeValidatorRoute, "route" | "acceptedResultRoutes">): BridgeValidatorRoute => ({
	key,
	from,
	to,
	route: formatBridgeRoute(from, to),
	cliFrom,
	cliTo,
	acceptedResultRoutes: [
		formatBridgeRoute(from, to),
		formatBridgeRoute(cliFrom ?? from, cliTo ?? to)
	],
	direction
})

export const validatorRoutes = {
	minaToZeko: validatorRoute({
		key: "mina-to-zeko",
		from: MINA_NETWORKS.testnet,
		to: ZEKO_M_NETWORKS.testnet,
		cliFrom: MINA_NETWORKS.testnet,
		cliTo: LEGACY_ZEKO_M_NETWORKS.testnet,
		direction: "deposit"
	}),
	zekoToMina: validatorRoute({
		key: "zeko-to-mina",
		from: ZEKO_M_NETWORKS.testnet,
		to: MINA_NETWORKS.testnet,
		cliFrom: LEGACY_ZEKO_M_NETWORKS.testnet,
		cliTo: MINA_NETWORKS.testnet,
		direction: "withdrawal"
	})
} satisfies Record<string, BridgeValidatorRoute>

export const validatorRouteAmounts = {
	"mina-to-zeko": "2",
	"zeko-to-mina": "2"
} satisfies Record<BridgeValidatorRouteKey, string>

export const validatorRouteKeys = [
	validatorRoutes.minaToZeko.key,
	validatorRoutes.zekoToMina.key
] as const satisfies readonly BridgeValidatorRouteKey[]

export const validatorRoutesByKey = {
	"mina-to-zeko": validatorRoutes.minaToZeko,
	"zeko-to-mina": validatorRoutes.zekoToMina
} satisfies Record<BridgeValidatorRouteKey, BridgeValidatorRoute>

export const getValidatorRoute = (routeKey: BridgeValidatorRouteKey): BridgeValidatorRoute =>
	validatorRoutesByKey[routeKey]

export const getValidatorRouteAmount = (routeKey: BridgeValidatorRouteKey) =>
	validatorRouteAmounts[routeKey]
