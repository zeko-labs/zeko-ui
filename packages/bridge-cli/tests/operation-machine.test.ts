import { describe, expect, it } from "vitest"
import { createOperationStateController } from "../src/core/operation-machine"

describe("operation machine", () => {
	it("tracks the bridge phase lifecycle", () => {
		const controller = createOperationStateController({
			phase: "initializing",
			status: "running"
		})

		expect(controller.transition({ type: "MARK_SUBMITTED" })).toEqual({
			phase: "submitted",
			status: "running"
		})
		expect(controller.transition({ type: "MARK_WAITING_SUBMISSION" })).toEqual({
			phase: "waiting-submission",
			status: "running"
		})
		expect(controller.transition({ type: "MARK_WAITING_PRIOR_CLAIMS" })).toEqual({
			phase: "waiting-prior-claims",
			status: "running"
		})
		expect(controller.transition({ type: "MARK_WAITING_FINALIZATION" })).toEqual({
			phase: "waiting-finalization",
			status: "running"
		})
		expect(controller.transition({ type: "MARK_RETRYING" })).toEqual({
			phase: "retrying",
			status: "running"
		})
		expect(controller.transition({ type: "MARK_FINALIZING" })).toEqual({
			phase: "finalizing",
			status: "running"
		})
		expect(controller.transition({ type: "MARK_COMPLETED" })).toEqual({
			phase: "completed",
			status: "completed"
		})
	})
})
