export type BridgeValidatorRouteKey = "mina-to-zeko" | "zeko-to-mina"

export type BridgeValidatorRoute = {
	key: BridgeValidatorRouteKey
	from: "mina:testnet" | "zeko-m-devnet"
	to: "mina:testnet" | "zeko-m-devnet"
	route: "mina:testnet->zeko-m-devnet" | "zeko-m-devnet->mina:testnet"
	direction: "deposit" | "withdrawal"
}

export const validatorRoutes = {
	minaToZeko: {
		key: "mina-to-zeko",
		from: "mina:testnet",
		to: "zeko-m-devnet",
		route: "mina:testnet->zeko-m-devnet",
		direction: "deposit"
	},
	zekoToMina: {
		key: "zeko-to-mina",
		from: "zeko-m-devnet",
		to: "mina:testnet",
		route: "zeko-m-devnet->mina:testnet",
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
