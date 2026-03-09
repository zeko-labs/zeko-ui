import { describe, expect, it } from "vitest"
import { renderTuiSnapshot } from "../src/commands/tui"
import type { OperationSession } from "../src/core/types"

describe("tui snapshot", () => {
	it("renders active and recent operations from persisted state", () => {
		const sessions: OperationSession[] = [
			{
				id: "op-new",
				status: "running",
				phase: "waiting",
				route: "mina:testnet->zeko:testnet",
				direction: "deposit",
				account: "B62new",
				recipient: "B62new",
				amount: "2",
				logPath: "/tmp/op-new.jsonl",
				createdAt: "2026-03-10T00:00:00.000Z",
				updatedAt: "2026-03-10T00:01:00.000Z",
				submittedTransactions: [{ action: "submit", hash: "submit-hash" }]
			},
			{
				id: "op-old",
				status: "completed",
				phase: "completed",
				route: "zeko:testnet->mina:testnet",
				direction: "withdrawal",
				account: "B62old",
				recipient: "B62old",
				amount: "1",
				logPath: "/tmp/op-old.jsonl",
				createdAt: "2026-03-09T00:00:00.000Z",
				updatedAt: "2026-03-09T00:01:00.000Z",
				submittedTransactions: [{ action: "submit", hash: "withdraw-hash" }]
			}
		]

		const output = renderTuiSnapshot({
			sessions,
			focus: sessions[0] ?? null,
			logContent: '{"event":"submitted"}\n{"event":"waiting"}\n'
		})

		expect(output).toContain("> op-new running mina:testnet->zeko:testnet amount=2")
		expect(output).toContain("op-old completed zeko:testnet->mina:testnet amount=1")
		expect(output).toContain("Recent log lines:")
		expect(output).toContain('{"event":"waiting"}')
	})
})
