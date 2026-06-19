import { describe, expect, it } from "vitest"
import { selectBridgeOperationView } from "../../app/components/bridgeOperationView"

const operation = (id: string) => ({ id })
const completedOperation = (id: string) => ({
	id,
	getSnapshot: () => ({ value: "BRIDGE_OPERATION_COMPLETED" })
})

describe("bridge operation view model", () => {
	it("returns to the input form when no operation is active", () => {
		const first = operation("first")
		const operations = new Map([["first", { status: "started" as const, operation: first }]])

		const view = selectBridgeOperationView({ operations, activeOperation: null })

		expect(view.currentOperation).toBeUndefined()
		expect(view.queuedOperations).toEqual([])
	})

	it("moves the queued active operation into the current slot after completion", () => {
		const completed = operation("completed")
		const queued = operation("queued")
		const laterQueued = operation("laterQueued")
		const operations = new Map([
			["completed", { status: "completed" as const, operation: completed }],
			["queued", { status: "started" as const, operation: queued }],
			["laterQueued", { status: "paused" as const, operation: laterQueued }]
		])

		const view = selectBridgeOperationView({ operations, activeOperation: "queued" })

		expect(view.currentOperation).toBe(queued)
		expect(view.queuedOperations).toEqual([laterQueued])
		expect(view.completedOperations).toEqual([
			{ id: "completed", status: "completed", operation: completed }
		])
	})

	it("uses the parent operation status instead of the child actor snapshot for completion", () => {
		const completed = completedOperation("completed")
		const operations = new Map([
			["completed", { status: "started" as const, operation: completed }]
		])

		const view = selectBridgeOperationView({ operations, activeOperation: "completed" })

		expect(view.currentOperation).toBe(completed)
		expect(view.completedOperations).toEqual([])
	})
})
