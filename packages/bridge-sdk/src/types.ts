import type { Field, NetworkId, PublicKey, UInt32, UInt64 } from "o1js"

export type Config = {
	l1Url: string
	l1ArchiveUrl: string
	zekoUrl: string
	zekoArchiveUrl: string
	l1Network: NetworkId
	l2Network: NetworkId
	pollTimeout?: number
}

export type Action = {
	action: Field[]
	beforeActionState: Field
	afterActionState: Field
	timestamp: string
	status: string
	hash: string
}

export type Deposit = {
	recipient: PublicKey
	amount: UInt64
	timeout: UInt32
	holderAccountL1: PublicKey
	timedOut: boolean
}

export type Withdrawal = {
	recipient: PublicKey
	amount: UInt64
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

export type DepositWithFinalised = Deposit & { finalised: boolean }

export type MaybeDeposit = OuterWitness & { deposit: DepositWithFinalised | undefined }

export type OuterActionWithState = (MaybeDeposit | OuterCommit) & {
	synced: boolean
	accepted: boolean
	confirmed: boolean
}

export type InnerAction = InnerWitness

export type WithdrawalWithFinalised = Withdrawal & { finalised: boolean }

export type MaybeWithdrawal = InnerWitness & { withdrawal: WithdrawalWithFinalised | undefined }

export type InnerActionWithState = MaybeWithdrawal & {
	committed: boolean
	isPastWithdrawalDelay: boolean
}

export type Account = {
	zkappState?: string[] | null
}
