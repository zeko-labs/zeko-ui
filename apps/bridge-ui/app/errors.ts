export class QuietError extends Error {}

const walletRejectionPatterns = [/user reject/i, /connection declined/i]

export const isWalletRejection = (error: unknown): boolean => {
	const message = error instanceof Error ? error.message : String(error)
	return walletRejectionPatterns.some((pattern) => pattern.test(message))
}

export const toQuietIfWalletRejection = (error: unknown): Error => {
	if (isWalletRejection(error)) {
		const message = error instanceof Error ? error.message : String(error)
		return new QuietError(message)
	}
	return error instanceof Error ? error : new Error(String(error))
}
