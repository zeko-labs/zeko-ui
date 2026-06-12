export type ChainFamily = "mina" | "zeko" | "eth"
export type ChainRef =
	| "mina:testnet"
	| "mina:mainnet"
	| "zeko-m-devnet"
	| "zeko-m-mainnet"
	| "zeko-e-testnet"
	| "zeko-e-mainnet"
	| "eth:testnet"
	| "eth:mainnet"
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
		to: "zeko-m-devnet",
		enabled: true,
		direction: "deposit",
		label: "Mina testnet -> Zeko-M devnet"
	},
	{
		from: "zeko-m-devnet",
		to: "mina:testnet",
		enabled: true,
		direction: "withdrawal",
		label: "Zeko-M devnet -> Mina testnet"
	},
	{
		from: "mina:mainnet",
		to: "zeko-m-mainnet",
		enabled: true,
		direction: "deposit",
		label: "Mina mainnet -> Zeko-M mainnet"
	},
	{
		from: "zeko-m-mainnet",
		to: "mina:mainnet",
		enabled: true,
		direction: "withdrawal",
		label: "Zeko-M mainnet -> Mina mainnet"
	},
	{
		from: "eth:testnet",
		to: "zeko-e-testnet",
		enabled: false,
		direction: "deposit",
		label: "Ethereum testnet -> Zeko-E testnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko-e-testnet",
		to: "eth:testnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko-E testnet -> Ethereum testnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "eth:mainnet",
		to: "zeko-e-mainnet",
		enabled: false,
		direction: "deposit",
		label: "Ethereum mainnet -> Zeko-E mainnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko-e-mainnet",
		to: "eth:mainnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko-E mainnet -> Ethereum mainnet",
		reason: "Known route, not enabled yet."
	}
]

export const CHAIN_REFS: ChainRef[] = [
	...new Set(KNOWN_ROUTES.flatMap(({ from, to }) => [from, to]))
]

export const isChainRef = (value: string): value is ChainRef =>
	CHAIN_REFS.includes(value as ChainRef)

export const parseChainRef = (value: unknown, flag: string): ChainRef => {
	if (typeof value !== "string" || !isChainRef(value)) {
		throw new Error(`Invalid ${flag} chain: ${String(value)}`)
	}

	return value
}

export const parseRouteString = (value: string): [ChainRef, ChainRef] => {
	const [from, to] = value.split("->")
	if (typeof from !== "string" || typeof to !== "string" || !isChainRef(from) || !isChainRef(to)) {
		throw new Error(`Invalid persisted route: ${value}`)
	}

	return [from, to]
}

export const formatRoute = (from: ChainRef, to: ChainRef): `${ChainRef}->${ChainRef}` =>
	`${from}->${to}`

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
