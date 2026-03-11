export type BridgeValidatorRoute = {
	functionId: string
	eventName: string
	from: "mina:testnet" | "zeko:testnet"
	to: "mina:testnet" | "zeko:testnet"
	route: "mina:testnet->zeko:testnet" | "zeko:testnet->mina:testnet"
	direction: "deposit" | "withdrawal"
}

export const validatorRoutes = {
	minaToZeko: {
		functionId: "validate-mina-to-zeko",
		eventName: "bridge-validator/mina-to-zeko.requested",
		from: "mina:testnet",
		to: "zeko:testnet",
		route: "mina:testnet->zeko:testnet",
		direction: "deposit"
	},
	zekoToMina: {
		functionId: "validate-zeko-to-mina",
		eventName: "bridge-validator/zeko-to-mina.requested",
		from: "zeko:testnet",
		to: "mina:testnet",
		route: "zeko:testnet->mina:testnet",
		direction: "withdrawal"
	}
} satisfies Record<string, BridgeValidatorRoute>

export type BridgeValidatorRequest = {
	cliVersion: string
}
