type OperationStatus = "started" | "paused" | "completed"

type OperationEntry<TOperation> = {
	status: OperationStatus
	operation: TOperation
}

export type BridgeOperationViewItem<TOperation> = OperationEntry<TOperation> & {
	id: string
}

const isCompletedOperation = <TOperation>({ status }: OperationEntry<TOperation>) =>
	status === "completed"

const isIncompleteOperation = <TOperation>(entry: BridgeOperationViewItem<TOperation>) =>
	!isCompletedOperation(entry)

export const selectBridgeOperationView = <TOperation>({
	operations,
	activeOperation
}: {
	operations: Map<string, OperationEntry<TOperation>>
	activeOperation: string | null
}) => {
	const items = [...operations.entries()].map(
		([id, item]): BridgeOperationViewItem<TOperation> => ({
			id,
			...item
		})
	)

	const completedOperations = items.filter(isCompletedOperation)
	const currentOperation = activeOperation
		? items.find((item) => item.id === activeOperation && isIncompleteOperation(item))?.operation
		: undefined
	const queuedOperations = items
		.filter(isIncompleteOperation)
		.filter((item) => item.id !== activeOperation)
		.filter((item) => activeOperation !== null || item.status === "paused")
		.map((item) => item.operation)

	return {
		completedOperations,
		currentOperation,
		queuedOperations
	}
}
