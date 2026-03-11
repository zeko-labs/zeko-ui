export class QuietError extends Error {}

const walletRejectionPatterns = [/user reject/i, /connection declined/i]

export const isWalletRejection = (error: unknown): boolean => {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "object" && error !== null && "message" in error
				? String((error as { message: unknown }).message)
				: String(error)
	return walletRejectionPatterns.some((pattern) => pattern.test(message))
}

export const toQuietIfWalletRejection = (error: unknown): Error => {
	if (isWalletRejection(error)) {
		const message = error instanceof Error ? error.message : String(error)
		return new QuietError(message)
	}
	return error instanceof Error ? error : new Error(String(error))
}

const knownErrorMessages: [pattern: RegExp, userMessage: string][] = [
	// WEB-206: Auro wallet RPC method incompatibility
	[
		/Method not found/i,
		"Your wallet does not support this operation. Please update your Auro Wallet extension to the latest version."
	],
	// WEB-334: Backend outage after retries
	[
		/CombinedError.*\[Network\]/i,
		"The bridge service is temporarily unreachable. Please try again later."
	],
	// WEB-346: Backend GraphQL error
	[
		/CombinedError.*\[GraphQL\]/i,
		"The bridge service encountered an unexpected error. Please try again later."
	],
	// WEB-276: Fetch failure
	[
		/^TypeError: Load failed$/i,
		"A network request failed. Please check your connection and try again."
	],
	// WEB-317: Truncated backend response
	[
		/Unexpected end of input/i,
		"The bridge service returned an incomplete response. Please try again."
	],
	// WEB-204: Account data fetch failure
	[
		/Error getting account data/i,
		"Could not retrieve your account data. Please check your connection and try again."
	],
	// WEB-333, WEB-341, WEB-340: Bridge-SDK validation (corrupted backend data)
	[
		/Invalid actions data/i,
		"The bridge received invalid on-chain data. This is a temporary backend issue — please try again later."
	],
	[
		/Invalid witnesses data/i,
		"The bridge received invalid proof data. This is a temporary backend issue — please try again later."
	],
	[
		/Invalid commit.*withdrawal delay/i,
		"The bridge received invalid commitment data. This is a temporary backend issue — please try again later."
	],
	// WEB-258: Runtime config broken
	[
		/Invalid runtime config/i,
		"The bridge could not load network configuration. Please try again later or contact support."
	],
	// WEB-344: o1js range check (bad backend data)
	[
		/rangeCheck32/i,
		"The bridge received out-of-range data from the network. Please try again later."
	]
]

export const toUserFriendlyMessage = (error: unknown): string => {
	const message = error instanceof Error ? error.message : String(error)
	const match = knownErrorMessages.find(([pattern]) => pattern.test(message))
	return match ? match[1] : message
}
