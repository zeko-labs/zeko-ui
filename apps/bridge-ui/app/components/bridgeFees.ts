export const bridgeFeeDisclosure = {
	static: {
		requestMina: 0.1,
		claimMina: 0.1,
		totalMina: 0.2
	},
	deposit: {
		helperAccountCreationMina: 0.1,
		recipientAccountCreationMina: 0.1,
		maximumFirstOperationFeeMina: 0.4
	},
	withdrawal: {
		helperAccountCreationMina: 1,
		recipientAccountCreationMina: 1,
		maximumFirstOperationFeeMina: 2.2
	}
} as const

export type BridgeFeeDisclosure = typeof bridgeFeeDisclosure
