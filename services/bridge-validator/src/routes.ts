export type BridgeValidatorRouteKey = "mina-to-zeko" | "zeko-to-mina"

export type BridgeValidatorRoute = {
	key: BridgeValidatorRouteKey
	from: "mina:testnet" | "zeko:testnet"
	to: "mina:testnet" | "zeko:testnet"
	route: "mina:testnet->zeko:testnet" | "zeko:testnet->mina:testnet"
	direction: "deposit" | "withdrawal"
}

export const validatorRoutes = {
	minaToZeko: {
		key: "mina-to-zeko",
		from: "mina:testnet",
		to: "zeko:testnet",
		route: "mina:testnet->zeko:testnet",
		direction: "deposit"
	},
	zekoToMina: {
		key: "zeko-to-mina",
		from: "zeko:testnet",
		to: "mina:testnet",
		route: "zeko:testnet->mina:testnet",
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
