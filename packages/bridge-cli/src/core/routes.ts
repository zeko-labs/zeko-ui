export type ChainFamily = "mina" | "zeko" | "eth"
export type NetworkTier = "testnet" | "mainnet"
export type ChainRef = `${ChainFamily}:${NetworkTier}`
export type Direction = "deposit" | "withdrawal"

export type RouteDescriptor = {
	from: ChainRef
	to: ChainRef
	enabled: boolean
	direction: Direction
	label: string
	reason?: string
}

export const KNOWN_ROUTES: RouteDescriptor[] = [
	{
		from: "mina:testnet",
		to: "zeko:testnet",
		enabled: true,
		direction: "deposit",
		label: "Mina testnet -> Zeko testnet"
	},
	{
		from: "zeko:testnet",
		to: "mina:testnet",
		enabled: true,
		direction: "withdrawal",
		label: "Zeko testnet -> Mina testnet"
	},
	{
		from: "mina:mainnet",
		to: "zeko:mainnet",
		enabled: false,
		direction: "deposit",
		label: "Mina mainnet -> Zeko mainnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko:mainnet",
		to: "mina:mainnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko mainnet -> Mina mainnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "eth:testnet",
		to: "zeko:testnet",
		enabled: false,
		direction: "deposit",
		label: "Ethereum testnet -> Zeko testnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko:testnet",
		to: "eth:testnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko testnet -> Ethereum testnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "eth:mainnet",
		to: "zeko:mainnet",
		enabled: false,
		direction: "deposit",
		label: "Ethereum mainnet -> Zeko mainnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko:mainnet",
		to: "eth:mainnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko mainnet -> Ethereum mainnet",
		reason: "Known route, not enabled yet."
	}
]

export class UnknownRouteError extends Error {
	constructor(from: ChainRef, to: ChainRef) {
		super(`Unknown bridge route: ${from} -> ${to}`)
		this.name = "UnknownRouteError"
	}
}

export const resolveRoute = (from: ChainRef, to: ChainRef): RouteDescriptor => {
	const route = KNOWN_ROUTES.find((candidate) => candidate.from === from && candidate.to === to)
	if (!route) throw new UnknownRouteError(from, to)
	return route
}
