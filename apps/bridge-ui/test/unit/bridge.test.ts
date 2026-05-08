import { describe, expect, it } from "vitest"
import { releaseCancellationSlot } from "../../machines/bridgeCancellationSlot"

describe("bridgeMachine", () => {
	it("releases the cancellation slot when the completing operation owns it", async () => {
		expect(
			releaseCancellationSlot({
				activeCancellationOperation: "operation-1",
				operationId: "operation-1"
			})
		).toBeNull()
	})

	it("keeps the cancellation slot when another operation completes", async () => {
		expect(
			releaseCancellationSlot({
				activeCancellationOperation: "operation-1",
				operationId: "operation-2"
			})
		).toBe("operation-1")
	})
})
