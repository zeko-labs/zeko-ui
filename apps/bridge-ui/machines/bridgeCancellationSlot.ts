export const releaseCancellationSlot = ({
	activeCancellationOperation,
	operationId
}: {
	activeCancellationOperation: string | null
	operationId: string
}) => (activeCancellationOperation === operationId ? null : activeCancellationOperation)
