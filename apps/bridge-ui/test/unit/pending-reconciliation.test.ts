import { describe, expect, it } from "vitest"

import { completedOperationReconciliationHash } from "../../app/utils/pendingReconciliation"

describe("pending transaction reconciliation", () => {
	it("keeps locally finalizing operations in pending storage until backend completion is verified", () => {
		expect(
			completedOperationReconciliationHash({
				hash: "5JpendingHash",
				completionVerification: "unverified"
			})
		).toBeNull()
	})

	it("removes pending storage only after backend completion is verified", () => {
		expect(
			completedOperationReconciliationHash({
				hash: "5JpendingHash",
				completionVerification: "verified"
			})
		).toBe("5JpendingHash")
	})
})
