import type { Field, NetworkId, PublicKey, UInt32, UInt64 } from "o1js"

export type Config = {
	l1Url: string
	l1ArchiveUrl: string
	zekoUrl: string
	l1Network: NetworkId
	l2Network: NetworkId
	pollTimeout?: number
}

export type Action = {
	action: Field[]
	beforeActionState: Field
	afterActionState: Field
}

export type OuterWitness = {
	type: "witness"
	aux: Field
	action: Action
}

export type OuterCommit = {
	type: "commit"
	ledger: Field
	innerActionState: Field
	innerActionStateLength: UInt32
	synchronizedOuterActionState: Field
	synchronizedOuterActionStateLength: UInt32
	slotRange: {
		lower: UInt32
		upper: UInt32
	}
	isPastWithdrawalDelay: boolean
	action: Action
}

export type InnerWitness = {
	type: "witness"
	aux: Field
	action: Action
}

export type OuterAction = OuterWitness | OuterCommit

export type InnerAction = InnerWitness

export type Deposit = {
	recipient: PublicKey
	amount: UInt64
	timeout: UInt32
	holderAccountL1: PublicKey
}

export type Withdrawal = {
	recipient: PublicKey
	amount: UInt64
}

export type Account = {
	zkappState?: string[] | null
}

export type Deposits = {
	beforeActionState: Field
	afterActionState: Field
	recipient: PublicKey
	amount: UInt64
	timeout: UInt32
	holderAccountL1: PublicKey
	outerPk: PublicKey
	timedOut: boolean
}[]

export type Withdrawals = {
	beforeActionState: Field
	afterActionState: Field
	recipient: PublicKey
	amount: UInt64
}[]
