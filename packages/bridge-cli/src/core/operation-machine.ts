import { assign, createActor, setup } from "xstate"
import type { OperationPhase, OperationStatus } from "./types"

type OperationMachineEvent =
	| { type: "MARK_INITIALIZING" }
	| { type: "MARK_SUBMITTED" }
	| { type: "MARK_WAITING_SUBMISSION" }
	| { type: "MARK_WAITING_PRIOR_CLAIMS" }
	| { type: "MARK_WAITING_FINALIZATION" }
	| { type: "MARK_RETRYING" }
	| { type: "MARK_FINALIZING" }
	| { type: "MARK_CANCELLING" }
	| { type: "MARK_COMPLETED" }
	| { type: "MARK_CANCELLED" }
	| { type: "MARK_FAILED" }

const operationMachine = setup({
	types: {
		context: {} as {
			phase: OperationPhase
			status: OperationStatus
		},
		events: {} as OperationMachineEvent,
		input: {} as {
			phase: OperationPhase
			status: OperationStatus
		}
	}
}).createMachine({
	id: "bridge-cli-operation",
	initial: "tracking",
	context: ({ input }) => input,
	states: {
		tracking: {
			on: {
				MARK_INITIALIZING: {
					actions: assign({
						phase: "initializing"
					})
				},
				MARK_SUBMITTED: {
					actions: assign({
						phase: "submitted",
						status: "running"
					})
				},
				MARK_WAITING_SUBMISSION: {
					actions: assign({
						phase: "waiting-submission",
						status: "running"
					})
				},
				MARK_WAITING_PRIOR_CLAIMS: {
					actions: assign({
						phase: "waiting-prior-claims",
						status: "running"
					})
				},
				MARK_WAITING_FINALIZATION: {
					actions: assign({
						phase: "waiting-finalization",
						status: "running"
					})
				},
				MARK_RETRYING: {
					actions: assign({
						phase: "retrying",
						status: "running"
					})
				},
				MARK_FINALIZING: {
					actions: assign({
						phase: "finalizing",
						status: "running"
					})
				},
				MARK_CANCELLING: {
					actions: assign({
						phase: "canceling",
						status: "running"
					})
				},
				MARK_COMPLETED: {
					actions: assign({
						phase: "completed",
						status: "completed"
					})
				},
				MARK_CANCELLED: {
					actions: assign({
						phase: "cancelled",
						status: "cancelled"
					})
				},
				MARK_FAILED: {
					actions: assign({
						phase: "failed",
						status: "failed"
					})
				}
			}
		}
	}
})

export const createOperationStateController = (input: {
	phase: OperationPhase
	status: OperationStatus
}) => {
	const actor = createActor(operationMachine, { input })
	actor.start()

	return {
		transition(event: OperationMachineEvent): {
			phase: OperationPhase
			status: OperationStatus
		} {
			actor.send(event)
			return actor.getSnapshot().context
		}
	}
}
