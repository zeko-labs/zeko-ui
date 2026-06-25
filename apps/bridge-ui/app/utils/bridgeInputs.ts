import type { BridgeNetwork } from "~~/machines/networks"
import { isMinaBridgeNetwork } from "~~/machines/networks"

const MINA_TO_ZEKO_MINIMUM_AMOUNT_MINA = 5
const ZEKO_TO_MINA_MINIMUM_AMOUNT_MINA = 3

export type BridgeAmountInput = number | string | undefined

type BridgeRoute = {
	source: BridgeNetwork
	destination: BridgeNetwork
}

export const normalizeBridgeAmountInput = (amount: BridgeAmountInput): number | undefined => {
	if (typeof amount === "number") return Number.isFinite(amount) ? amount : undefined
	if (typeof amount !== "string") return undefined

	const trimmedAmount = amount.trim()
	if (trimmedAmount.length === 0) return undefined

	const parsedAmount = Number(trimmedAmount)
	return Number.isFinite(parsedAmount) ? parsedAmount : undefined
}

export const selectedBridgeMinimumAmountMina = ({ source }: BridgeRoute): number =>
	isMinaBridgeNetwork(source) ? MINA_TO_ZEKO_MINIMUM_AMOUNT_MINA : ZEKO_TO_MINA_MINIMUM_AMOUNT_MINA

export const amountIsBelowBridgeMinimum = ({
	amount,
	source,
	destination
}: BridgeRoute & { amount: BridgeAmountInput }): boolean => {
	const normalizedAmount = normalizeBridgeAmountInput(amount)
	return (
		normalizedAmount !== undefined &&
		normalizedAmount < selectedBridgeMinimumAmountMina({ source, destination })
	)
}

export const canStartBridgeOperation = ({
	address,
	amount,
	loading,
	source,
	destination
}: BridgeRoute & {
	address: string
	amount: BridgeAmountInput
	loading: boolean
}): boolean => {
	const normalizedAmount = normalizeBridgeAmountInput(amount)
	return (
		!loading &&
		address.length > 0 &&
		normalizedAmount !== undefined &&
		normalizedAmount >= selectedBridgeMinimumAmountMina({ source, destination })
	)
}
