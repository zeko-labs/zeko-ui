export const FAUCET_CHAIN = "zeko-testnet"

export type FaucetSuccessResponse = {
	success: true
	hash: string
	amount: string
	address: string
	chain: typeof FAUCET_CHAIN
	explorer_url: string
}

export type FaucetErrorResponse = {
	success: false
	code: string
	message: string
}

export type FaucetResponse = FaucetSuccessResponse | FaucetErrorResponse

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

export const parseFaucetResponse = (value: unknown): FaucetResponse | null => {
	if (!isRecord(value) || typeof value.success !== "boolean") return null

	if (value.success) {
		if (
			typeof value.hash !== "string" ||
			typeof value.amount !== "string" ||
			typeof value.address !== "string" ||
			value.chain !== FAUCET_CHAIN ||
			typeof value.explorer_url !== "string"
		)
			return null

		return {
			success: true,
			hash: value.hash,
			amount: value.amount,
			address: value.address,
			chain: value.chain,
			explorer_url: value.explorer_url
		}
	}

	if (typeof value.code !== "string" || typeof value.message !== "string") return null

	return {
		success: false,
		code: value.code,
		message: value.message
	}
}
