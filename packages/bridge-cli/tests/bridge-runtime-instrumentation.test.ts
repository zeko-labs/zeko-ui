import { describe, expect, it } from "vitest"
import {
	withCapabilityWaitReason,
	withRecordedSdkCall
} from "../src/core/bridge-runtime/instrumentation"
import type { OperationSession } from "../src/core/types"

const session = {
	id: "op-instrumentation",
	status: "running",
	phase: "submitted",
	route: "mina:testnet->zeko:testnet",
	direction: "deposit",
	account: "B62account",
	recipient: "B62recipient",
	amount: "2",
	logPath: "/tmp/op-instrumentation.jsonl",
	createdAt: "2026-03-10T00:00:00.000Z",
	updatedAt: "2026-03-10T00:00:00.000Z",
	submittedTransactions: [],
	verboseDiagnostics: {
		sdkCalls: [],
		sdkMethodStats: {},
		phaseTimings: [{ phase: "submitted", startedAt: "2026-03-10T00:00:00.000Z", durationMs: 0 }],
		waitReasons: {}
	}
} satisfies OperationSession

describe("bridge runtime adapter instrumentation", () => {
	it("records SDK calls on verbose sessions", () => {
		const result = withRecordedSdkCall({
			session,
			trace: {
				operation: "canFinalizeDeposit",
				attempt: 1,
				startedAt: "2026-03-10T00:00:01.000Z",
				endedAt: "2026-03-10T00:00:01.250Z",
				durationMs: 250,
				success: true,
				result: "available=true"
			}
		})

		expect(result.verboseDiagnostics?.sdkMethodStats.canFinalizeDeposit).toMatchObject({
			count: 1,
			successCount: 1,
			errorCount: 0,
			totalDurationMs: 250,
			lastResult: "available=true"
		})
	})

	it("preserves capability wait reasons on verbose sessions", () => {
		const next = withCapabilityWaitReason({
			session,
			key: "canFinalizeDeposit",
			diagnostic: {
				available: false,
				reason: "not ready"
			}
		})

		expect(next.verboseDiagnostics?.waitReasons?.canFinalizeDeposit).toEqual({
			available: false,
			reason: "not ready"
		})
	})

	it("leaves non-verbose sessions unchanged", () => {
		const quietSession = { ...session, verboseDiagnostics: undefined }
		const result = withRecordedSdkCall({
			session: quietSession,
			trace: {
				operation: "getDepositStatuses",
				attempt: 1,
				startedAt: "2026-03-10T00:00:01.000Z",
				endedAt: "2026-03-10T00:00:01.000Z",
				durationMs: 0,
				success: true,
				result: "count=0"
			}
		})

		expect(result).toBe(quietSession)
	})
})
