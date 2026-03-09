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

export type OperationPhase =
	| "initializing"
	| "submitted"
	| "waiting"
	| "finalizing"
	| "canceling"
	| "finalized"
	| "completed"
	| "cancelled"
	| "failed"

export type OperationStatus = "running" | "completed" | "cancelled" | "failed"

export type OperationSession = {
	id: string
	status: OperationStatus
	phase: OperationPhase
	route: `${ChainRef}->${ChainRef}`
	direction: Direction
	account: string
	recipient?: string
	amount: string
	logPath: string
	createdAt: string
	updatedAt: string
	timeoutSlots?: number
	lastError?: string
	submittedTransactions: Array<{
		action: "submit" | "finalize" | "cancel"
		hash: string
	}>
	finalTransaction?: {
		action: "submit" | "finalize" | "cancel"
		hash: string
		explorerUrl: string
	}
}
