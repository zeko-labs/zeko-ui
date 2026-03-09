import type { ChainRef, Direction } from "./routes"

export type DepositStatus = {
	index: number
	amount: string
	recipient: string
	cancelled: boolean
	synced: boolean
	accepted: boolean
	confirmed: boolean
	finalised: boolean
	hash: string
	timestamp: string
}

export type WithdrawalStatus = {
	index: number
	amount: string
	recipient: string
	committed: boolean
	finalised: boolean
	hash: string
	timestamp: string
}

export type TransactionResult = {
	success: true
	direction: Direction
	action: "submit" | "finalize" | "cancel"
	route: `${ChainRef}->${ChainRef}`
	hash: string
	explorerUrl: string
	included: boolean
	zkAppId?: string
}

export type StatusResult<T> = {
	success: true
	direction: Direction
	route: `${ChainRef}->${ChainRef}`
	account: string
	count: number
	operations: T[]
}
