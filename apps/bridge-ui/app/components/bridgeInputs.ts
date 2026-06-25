export const BRIDGE_MINIMUM_AMOUNT_MINA = 2

export const canStartBridgeOperation = ({
	address,
	amount,
	loading
}: {
	address: string
	amount: number | undefined
	loading: boolean
}): boolean =>
	!loading &&
	address.length > 0 &&
	typeof amount === "number" &&
	Number.isFinite(amount) &&
	amount >= BRIDGE_MINIMUM_AMOUNT_MINA
