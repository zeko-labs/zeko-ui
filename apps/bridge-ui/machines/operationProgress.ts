export type BridgeOperationProgress = {
	confirmationsRemaining: number
}

export const bridgeOperationProgress = ({
	actionIndex,
	confirmedIndex
}: {
	actionIndex: number
	confirmedIndex: number
}): BridgeOperationProgress | undefined => {
	const confirmationsRemaining = actionIndex - confirmedIndex
	return confirmationsRemaining > 0 ? { confirmationsRemaining } : undefined
}
