import { describe, expect, it } from "vitest"
import { projectOperationStatus } from "../src/session"
import type { OperationSession } from "../src/types"

const session = {
	id: "op-projection",
	status: "running",
	phase: "submitted",
	route: "mina:testnet->zeko:testnet",
	direction: "deposit",
	account: "B62account",
	recipient: "B62recipient",
	amount: "2",
	logPath: "/tmp/op-projection.jsonl",
	createdAt: "2026-03-10T00:00:00.000Z",
	updatedAt: "2026-03-10T00:00:00.000Z",
	submittedTransactions: [{ action: "submit", hash: "deposit-hash" }],
	liveSnapshot: {
		refreshedAt: "2026-03-10T00:00:10.000Z",
		nextAction: "cancel",
		waitingOn: "finalization",
		targetIndex: 0,
		claimableIndex: 0,
		pendingAhead: 0,
		canFinalize: false,
		canCancel: true,
		submitHash: "deposit-hash",
		observedCounts: { deposits: 1, withdrawals: 0 }
	}
} satisfies OperationSession

describe("operation status projection", () => {
	it("keeps the cancellation-ready phase stable for JSON consumers", () => {
		expect(projectOperationStatus(session)).toMatchObject({
			id: "op-projection",
			status: "running",
			phase: "ready-cancellation",
			route: "mina:testnet->zeko:testnet",
			direction: "deposit",
			account: "B62account",
			recipient: "B62recipient",
			amount: "2",
			log_path: "/tmp/op-projection.jsonl",
			refreshed_at: "2026-03-10T00:00:10.000Z",
			target_index: 0,
			claimable_index: 0,
			pending_ahead: 0,
			can_finalize: false,
			can_cancel: true,
			submit_hash: "deposit-hash",
			next_action: "cancel",
			waiting_on: "finalization",
			error: null
		})
	})
})
