type OperationStatus = "started" | "paused" | "completed"

type OperationEntry<TOperation> = {
	status: OperationStatus
	operation: TOperation
}

type SnapshotOperation = {
	getSnapshot: () => { value: unknown }
}

export type BridgeOperationViewItem<TOperation> = OperationEntry<TOperation> & {
	id: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

const stateValueIncludes = (value: unknown, fragment: string): boolean => {
	if (typeof value === "string") return value.includes(fragment)
	if (!isRecord(value)) return false

	return Object.entries(value).some(
		([key, nested]) => key.includes(fragment) || stateValueIncludes(nested, fragment)
	)
}

const hasSnapshot = (operation: unknown): operation is SnapshotOperation =>
	isRecord(operation) && "getSnapshot" in operation && typeof operation.getSnapshot === "function"

const isCompletedOperation = <TOperation>({ status, operation }: OperationEntry<TOperation>) => {
	if (status === "completed") return true
	if (!hasSnapshot(operation)) return false

	const snapshotValue = operation.getSnapshot().value
	return snapshotValue === "BRIDGE_OPERATION_COMPLETED" || stateValueIncludes(snapshotValue, "DONE")
}

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
		? items.find((item) => item.id === activeOperation && !isCompletedOperation(item))?.operation
		: undefined
	const queuedOperations = items
		.filter((item) => !isCompletedOperation(item))
		.filter((item) => item.id !== activeOperation)
		.filter((item) => activeOperation !== null || item.status === "paused")
		.map((item) => item.operation)

	return {
		completedOperations,
		currentOperation,
		queuedOperations
	}
}
