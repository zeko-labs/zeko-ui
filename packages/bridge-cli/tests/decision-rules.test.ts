import { describe, expect, it } from "vitest"
import { decideDepositStep, decideWithdrawalStep } from "../src/decisions"
import type { DepositStatus, OperationSession, WithdrawalStatus } from "../src/types"

const session = {
	id: "op-decision",
	status: "running",
	phase: "submitted",
	route: "mina:testnet->zeko:testnet",
	direction: "deposit",
	account: "B62account",
	recipient: "B62recipient",
	amount: "2",
	logPath: "/tmp/op-decision.jsonl",
	createdAt: "2026-03-10T00:00:00.000Z",
	updatedAt: "2026-03-10T00:00:00.000Z",
	submittedTransactions: []
} satisfies OperationSession

const deposit = (input: Partial<DepositStatus> & Pick<DepositStatus, "index">): DepositStatus => ({
	index: input.index,
	amount: input.amount ?? "2",
	recipient: input.recipient ?? "B62recipient",
	cancelled: input.cancelled ?? false,
	cancellable: input.cancellable,
	synced: input.synced ?? true,
	accepted: input.accepted ?? true,
	confirmed: input.confirmed ?? true,
	finalised: input.finalised ?? false,
	hash: input.hash ?? `deposit-${input.index}`,
	timestamp: input.timestamp ?? "2026-03-10T00:00:00.000Z"
})

const withdrawal = (
	input: Partial<WithdrawalStatus> & Pick<WithdrawalStatus, "index">
): WithdrawalStatus => ({
	index: input.index,
	amount: input.amount ?? "2",
	recipient: input.recipient ?? "B62recipient",
	committed: input.committed ?? true,
	finalised: input.finalised ?? false,
	hash: input.hash ?? `withdrawal-${input.index}`,
	timestamp: input.timestamp ?? "2026-03-10T00:00:00.000Z"
})

describe("bridge CLI decision rules", () => {
	it("submits a deposit when there is no unresolved deposit before a submit hash exists", () => {
		expect(
			decideDepositStep({
				session,
				statuses: [],
				canFinalize: { available: false, reason: "not ready" },
				canCancel: { available: false, reason: "not ready" }
			}).action
		).toBe("submit")
	})

	it("waits for deposit submission visibility after a submit hash exists", () => {
		const decision = decideDepositStep({
			session: {
				...session,
				submittedTransactions: [{ action: "submit", hash: "deposit-submit" }]
			},
			statuses: [],
			canFinalize: { available: false, reason: "not ready" },
			canCancel: { available: false, reason: "not ready" }
		})

		expect(decision.action).toBe("wait")
		expect(decision.action === "wait" ? decision.event : undefined).toBe("MARK_WAITING_SUBMISSION")
	})

	it("finalizes a claimable deposit when no prior blocking deposit remains", () => {
		const decision = decideDepositStep({
			session: {
				...session,
				submittedTransactions: [{ action: "submit", hash: "deposit-submit" }]
			},
			statuses: [deposit({ index: 0, hash: "deposit-submit" })],
			canFinalize: { available: true, reason: null, index: 0 },
			canCancel: { available: false, reason: "not ready" }
		})

		expect(decision.action).toBe("finalize")
		expect(decision.action === "finalize" ? decision.claimableIndex : undefined).toBe(0)
	})

	it("cancels a skippable older deposit before finalizing a later target", () => {
		const decision = decideDepositStep({
			session: {
				...session,
				targetIndex: 1,
				submittedTransactions: [{ action: "submit", hash: "deposit-submit" }]
			},
			statuses: [
				deposit({ index: 0, cancellable: true, confirmed: false }),
				deposit({ index: 1, hash: "deposit-submit" })
			],
			canFinalize: { available: false, reason: "blocked", index: 1 },
			canCancel: { available: true, reason: null, index: 0 }
		})

		expect(decision.action).toBe("cancel")
	})

	it("waits for withdrawal commit before finalization", () => {
		const decision = decideWithdrawalStep({
			session: {
				...session,
				direction: "withdrawal",
				route: "zeko:testnet->mina:testnet",
				submittedTransactions: [{ action: "submit", hash: "withdrawal-submit" }]
			},
			statuses: [withdrawal({ index: 0, hash: "withdrawal-submit", committed: false })],
			canFinalize: { available: false, reason: "not ready" }
		})

		expect(decision.action).toBe("wait")
		expect(decision.action === "wait" ? decision.event : undefined).toBe("MARK_WAITING_SUBMISSION")
	})

	it("does not complete a withdrawal from an already-finalised diagnostic for another index", () => {
		const decision = decideWithdrawalStep({
			session: {
				...session,
				direction: "withdrawal",
				route: "zeko:testnet->mina:testnet",
				submittedTransactions: [{ action: "submit", hash: "withdrawal-submit" }]
			},
			statuses: [withdrawal({ index: 1, hash: "withdrawal-submit", committed: true })],
			canFinalize: {
				available: false,
				reason: "Withdrawal already finalised",
				status: "alreadyFinalised",
				index: 0
			}
		})

		expect(decision.action).toBe("wait")
	})
})
