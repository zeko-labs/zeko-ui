export const BRIDGE_MINIMUM_AMOUNT_MINA = 2

export type BridgeAmountInput = number | string | undefined

export const normalizeBridgeAmountInput = (amount: BridgeAmountInput): number | undefined => {
	if (typeof amount === "number") return Number.isFinite(amount) ? amount : undefined
	if (typeof amount !== "string") return undefined

	const trimmedAmount = amount.trim()
	if (trimmedAmount.length === 0) return undefined

	const parsedAmount = Number(trimmedAmount)
	return Number.isFinite(parsedAmount) ? parsedAmount : undefined
}

export const amountIsBelowBridgeMinimum = (amount: BridgeAmountInput): boolean => {
	const normalizedAmount = normalizeBridgeAmountInput(amount)
	return normalizedAmount !== undefined && normalizedAmount < BRIDGE_MINIMUM_AMOUNT_MINA
}

export const canStartBridgeOperation = ({
	address,
	amount,
	loading
}: {
	address: string
	amount: BridgeAmountInput
	loading: boolean
}): boolean => {
	const normalizedAmount = normalizeBridgeAmountInput(amount)
	return (
		!loading &&
		address.length > 0 &&
		normalizedAmount !== undefined &&
		normalizedAmount >= BRIDGE_MINIMUM_AMOUNT_MINA
	)
}
