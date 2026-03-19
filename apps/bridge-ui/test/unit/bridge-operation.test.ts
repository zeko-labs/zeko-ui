import { describe, expect, it } from "vitest"
import { bridgeOperationMachine } from "../../machines/bridgeOperation"

describe("bridgeOperationMachine withdrawal fee error flow", () => {
	it("does not special-case a terminal fee error after submission", () => {
		const pendingWithdrawal = bridgeOperationMachine.config.states.PENDING_WITHDRAWAL
		expect(pendingWithdrawal.on).not.toHaveProperty("TerminalError")

		const finalizeOnError =
			bridgeOperationMachine.config.states.FINALIZE_WITHDRAWAL.states.transaction.invoke.onError
		expect(Array.isArray(finalizeOnError)).toBe(true)
		expect(finalizeOnError).toHaveLength(2)

		const failedTransitions = finalizeOnError.filter(
			(transition) => transition.target === "#bridgeOperation.FAILED"
		)
		expect(failedTransitions).toHaveLength(1)
		expect(String(failedTransitions[0].guard)).toContain("context.errors.length >= 3")
	})
})
