import { Field, Poseidon } from "o1js"
import type { Deposit } from "./types"

export function ethereumDepositAux(deposit: Deposit): Field {
	return Poseidon.hashWithPrefix("Ethereum deposit V1", [
		Field(0), // Empty children
		...deposit.holderAccountL1.toFields(),
		...deposit.amount.toFields(),
		...deposit.recipient.toFields(),
		...deposit.timeout.toFields()
	])
}
