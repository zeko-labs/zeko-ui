import { describe, expect, it } from "vitest"
import {
	renderBridgeResult,
	renderOperationProgress,
	toBridgeJsonResult
} from "../src/core/reporter"
import type { OperationSession } from "../src/core/types"

const session: OperationSession = {
	id: "op-1",
	status: "completed",
	phase: "completed",
	route: "mina:testnet->zeko:testnet",
	direction: "deposit",
	account: "B62account",
	recipient: "B62recipient",
	amount: "5",
	queueAdvances: 2,
	logPath: "/tmp/op-1.jsonl",
	createdAt: "2026-03-10T00:00:00.000Z",
	updatedAt: "2026-03-10T00:01:00.000Z",
	submittedTransactions: [
		{ action: "submit", hash: "submit-hash" },
		{ action: "finalize", hash: "finalize-hash" }
	],
	finalTransaction: {
		action: "finalize",
		hash: "finalize-hash",
		explorerUrl: "https://zekoscan.io/testnet/tx/finalize-hash"
	}
}

describe("reporter", () => {
	it("formats the final json contract", () => {
		expect(toBridgeJsonResult(session)).toEqual({
			success: true,
			operation_id: "op-1",
			route: "mina:testnet->zeko:testnet",
			direction: "deposit",
			status: "completed",
			amount: "5",
			recipient: "B62recipient",
			submitted_transactions: [
				{ action: "submit", hash: "submit-hash" },
				{ action: "finalize", hash: "finalize-hash" }
			],
			final_transaction: {
				action: "finalize",
				hash: "finalize-hash",
				explorerUrl: "https://zekoscan.io/testnet/tx/finalize-hash"
			},
			explorer_urls: ["https://zekoscan.io/testnet/tx/finalize-hash"],
			log_path: "/tmp/op-1.jsonl",
			error: null
		})
	})

	it("renders stable human output", () => {
		expect(renderBridgeResult(session)).toContain("Recipient: B62recipient")
		expect(renderBridgeResult(session)).toContain("Queued operations claimed: 2")
		expect(renderBridgeResult(session)).toContain("Final hash: finalize-hash")
		expect(renderBridgeResult({ ...session, lastError: "terminal protocol error" })).toContain(
			"Error: terminal protocol error"
		)
		expect(
			renderOperationProgress({
				event: "submitted",
				phase: "submitted",
				details: { hash: "submit-hash" }
			})
		).toContain("hash=submit-hash")
	})
})
