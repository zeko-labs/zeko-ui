import { describe, expect, it } from "vitest"
import { classifyRecoveredOperations } from "../../machines/recovery"

const actionState = ({
	id,
	index,
	date,
	finalised = false,
	cancelled = false,
	cancellable = false,
	source = "mina:devnet",
	destination = "zeko:testnet"
}: {
	id: string
	index: number
	date: string
	finalised?: boolean
	cancelled?: boolean
	cancellable?: boolean
	source?: "mina:devnet" | "zeko:testnet"
	destination?: "mina:devnet" | "zeko:testnet"
}) => ({
	id,
	index,
	recipient: "B62test",
	amount: "1",
	cancelled,
	cancellable,
	finalised,
	transaction: {
		date: new Date(date),
		hash: `${id}-hash`
	},
	source,
	destination
})

describe("classifyRecoveredOperations", () => {
	it("routes multiple cancellable deposits into the cancellation lane", () => {
		const result = classifyRecoveredOperations({
			deposits: [
				actionState({ id: "deposit-2", index: 2, date: "2026-03-24T00:10:00Z", cancellable: true }),
				actionState({ id: "deposit-1", index: 1, date: "2026-03-24T00:00:00Z", cancellable: true }),
				actionState({ id: "deposit-3", index: 3, date: "2026-03-24T00:20:00Z" })
			],
			withdrawals: []
		})

		expect(result.cancellableDeposits.map((item) => item.actionState.id)).toEqual([
			"deposit-1",
			"deposit-2"
		])
		expect(result.mainPending.map((item) => item.actionState.id)).toEqual(["deposit-3"])
	})

	it("serializes non-cancellable deposits and withdrawals by recovery order", () => {
		const result = classifyRecoveredOperations({
			deposits: [actionState({ id: "deposit-1", index: 2, date: "2026-03-24T00:10:00Z" })],
			withdrawals: [
				actionState({
					id: "withdrawal-1",
					index: 1,
					date: "2026-03-24T00:00:00Z",
					source: "zeko:testnet",
					destination: "mina:devnet"
				})
			]
		})

		expect(result.mainPending.map((item) => item.actionState.id)).toEqual([
			"withdrawal-1",
			"deposit-1"
		])
	})

	it("keeps cancelled deposits out of both pending lanes", () => {
		const result = classifyRecoveredOperations({
			deposits: [
				actionState({ id: "cancelled", index: 1, date: "2026-03-24T00:00:00Z", cancelled: true })
			],
			withdrawals: []
		})

		expect(result.mainPending).toEqual([])
		expect(result.cancellableDeposits).toEqual([])
		expect(result.cancelledDeposits.map((item) => item.id)).toEqual(["cancelled"])
	})
})
