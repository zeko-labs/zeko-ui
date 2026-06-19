import { describe, expect, it } from "vitest"
import {
	buildRecoverySyncState,
	classifyRecoveredOperations,
	matchRecoveryOperationIds
} from "../../machines/recovery"

const actionState = ({
	id,
	index,
	date,
	finalised = false,
	cancelled = false,
	cancellable = false,
	source = "mina:devnet",
	destination = "zeko-m:testnet"
}: {
	id: string
	index: number
	date: string
	finalised?: boolean
	cancelled?: boolean
	cancellable?: boolean
	source?: "mina:devnet" | "zeko-m:testnet"
	destination?: "mina:devnet" | "zeko-m:testnet"
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
			withdrawals: [],
			currentSlot: "0"
		})

		expect(result.cancellableDeposits.map((item) => item.actionState.id)).toEqual([
			"deposit-1",
			"deposit-2"
		])
		expect(result.mainPending.map((item) => item.actionState.id)).toEqual(["deposit-3"])
	})

	it("orders the main lane as deposits first and withdrawals after", () => {
		const result = classifyRecoveredOperations({
			deposits: [actionState({ id: "deposit-1", index: 2, date: "2026-03-24T00:10:00Z" })],
			withdrawals: [
				actionState({
					id: "withdrawal-1",
					index: 1,
					date: "2026-03-24T00:00:00Z",
					source: "zeko-m:testnet",
					destination: "mina:devnet"
				})
			],
			currentSlot: "0"
		})

		expect(result.mainPending.map((item) => item.actionState.id)).toEqual([
			"deposit-1",
			"withdrawal-1"
		])
	})

	it("uses action index as the authoritative pending order even when timestamps disagree", () => {
		const result = classifyRecoveredOperations({
			deposits: [
				actionState({ id: "deposit-older-index", index: 1, date: "2026-03-24T00:10:00Z" }),
				actionState({ id: "deposit-newer-index", index: 2, date: "2026-03-24T00:00:00Z" })
			],
			withdrawals: [],
			currentSlot: "0"
		})

		expect(result.mainPending.map((item) => item.actionState.id)).toEqual([
			"deposit-older-index",
			"deposit-newer-index"
		])
	})

	it("keeps cancelled deposits out of both pending lanes", () => {
		const result = classifyRecoveredOperations({
			deposits: [
				actionState({ id: "cancelled", index: 1, date: "2026-03-24T00:00:00Z", cancelled: true })
			],
			withdrawals: [],
			currentSlot: "0"
		})

		expect(result.mainPending).toEqual([])
		expect(result.cancellableDeposits).toEqual([])
		expect(result.cancelledDeposits.map((item) => item.id)).toEqual(["cancelled"])
	})

	it("collects completed deposits and withdrawals without mixing them into pending lanes", () => {
		const result = classifyRecoveredOperations({
			deposits: [
				actionState({
					id: "completed-deposit",
					index: 1,
					date: "2026-03-24T00:00:00Z",
					finalised: true
				})
			],
			withdrawals: [
				actionState({
					id: "completed-withdrawal",
					index: 2,
					date: "2026-03-24T00:05:00Z",
					finalised: true,
					source: "zeko-m:testnet",
					destination: "mina:devnet"
				})
			],
			currentSlot: "0"
		})

		expect(result.mainPending).toEqual([])
		expect(result.cancellableDeposits).toEqual([])
		expect(result.completedDeposits.map((item) => item.id)).toEqual(["completed-deposit"])
		expect(result.completedWithdrawals.map((item) => item.id)).toEqual(["completed-withdrawal"])
	})

	it("orders both pending lanes by action index", () => {
		const result = classifyRecoveredOperations({
			deposits: [
				actionState({ id: "main-deposit", index: 4, date: "2026-03-24T00:00:00Z" }),
				actionState({ id: "cancel-b", index: 3, date: "2026-03-24T01:00:00Z", cancellable: true }),
				actionState({ id: "cancel-a", index: 1, date: "2026-03-24T01:30:00Z", cancellable: true })
			],
			withdrawals: [
				actionState({
					id: "withdrawal",
					index: 2,
					date: "2026-03-24T00:00:00Z",
					source: "zeko-m:testnet",
					destination: "mina:devnet"
				})
			],
			currentSlot: "0"
		})

		expect(result.mainPending.map((item) => item.actionState.id)).toEqual([
			"main-deposit",
			"withdrawal"
		])
		expect(result.cancellableDeposits.map((item) => item.actionState.id)).toEqual([
			"cancel-a",
			"cancel-b"
		])
	})

	it("builds refresh state that moves paused cancellable deposits into the cancellation lane", () => {
		const recovered = classifyRecoveredOperations({
			deposits: [
				actionState({ id: "deposit-1", index: 1, date: "2026-03-24T00:00:00Z" }),
				actionState({
					id: "deposit-2",
					index: 2,
					date: "2026-03-24T00:01:00Z",
					cancellable: true
				})
			],
			withdrawals: [],
			currentSlot: "0"
		})

		const result = buildRecoverySyncState({
			recovered,
			entryStateById: new Map([
				["deposit-1", { status: "started", lane: "main" }],
				["deposit-2", { status: "paused", lane: "main" }]
			])
		})

		expect(result.pendingOperations).toEqual([
			{
				id: "deposit-1",
				lane: "main",
				order: 0,
				status: "started",
				cancellable: false,
				timeoutSlot: undefined
			},
			{
				id: "deposit-2",
				lane: "cancellation",
				order: 0,
				status: "paused",
				cancellable: true,
				timeoutSlot: undefined
			}
		])
		expect(result.activeOperation).toBe("deposit-1")
		expect(result.activeCancellationOperation).toBeNull()
	})

	it("moves a started cancellable deposit into the cancellation lane and promotes the next main operation", () => {
		const recovered = classifyRecoveredOperations({
			deposits: [
				actionState({
					id: "deposit-1",
					index: 1,
					date: "2026-03-24T00:00:00Z",
					cancellable: true
				}),
				actionState({ id: "deposit-2", index: 2, date: "2026-03-24T00:01:00Z" })
			],
			withdrawals: [],
			currentSlot: "0"
		})

		const result = buildRecoverySyncState({
			recovered,
			entryStateById: new Map([
				["deposit-1", { status: "started", lane: "main" }],
				["deposit-2", { status: "paused", lane: "main" }]
			])
		})

		expect(result.pendingOperations).toEqual([
			{
				id: "deposit-2",
				lane: "main",
				order: 0,
				status: "started",
				cancellable: false,
				timeoutSlot: undefined
			},
			{
				id: "deposit-1",
				lane: "cancellation",
				order: 0,
				status: "paused",
				cancellable: true,
				timeoutSlot: undefined
			}
		])
		expect(result.activeOperation).toBe("deposit-2")
		expect(result.activeCancellationOperation).toBeNull()
	})

	it("keeps the active main operation ahead of newly recovered queued operations", () => {
		const recovered = classifyRecoveredOperations({
			deposits: [actionState({ id: "deposit-2", index: 2, date: "2026-03-24T00:01:00Z" })],
			withdrawals: [
				actionState({
					id: "withdrawal-1",
					index: 1,
					date: "2026-03-24T00:00:00Z",
					source: "zeko-m:testnet",
					destination: "mina:devnet"
				})
			],
			currentSlot: "0"
		})

		const result = buildRecoverySyncState({
			recovered,
			entryStateById: new Map([["withdrawal-1", { status: "started", lane: "main" }]])
		})

		expect(result.pendingOperations).toEqual([
			{
				id: "withdrawal-1",
				lane: "main",
				order: 0,
				status: "started",
				cancellable: false,
				timeoutSlot: undefined
			},
			{
				id: "deposit-2",
				lane: "main",
				order: 1,
				status: "paused",
				cancellable: false,
				timeoutSlot: undefined
			}
		])
		expect(result.activeOperation).toBe("withdrawal-1")
		expect(result.activeCancellationOperation).toBeNull()
	})

	it("keeps locally completed operations out of recovered pending lanes", () => {
		const recovered = classifyRecoveredOperations({
			deposits: [actionState({ id: "deposit-1", index: 1, date: "2026-03-24T00:00:00Z" })],
			withdrawals: [],
			currentSlot: "0"
		})

		const result = buildRecoverySyncState({
			recovered,
			entryStateById: new Map([["deposit-1", { status: "completed", lane: "main" }]])
		})

		expect(result.pendingOperations).toEqual([])
		expect(result.activeOperation).toBeNull()
		expect(result.activeCancellationOperation).toBeNull()
	})

	it("keeps an already-started cancellation-lane operation active during refresh", () => {
		const recovered = classifyRecoveredOperations({
			deposits: [
				actionState({
					id: "deposit-1",
					index: 1,
					date: "2026-03-24T00:00:00Z",
					cancellable: true
				})
			],
			withdrawals: [],
			currentSlot: "0"
		})

		const result = buildRecoverySyncState({
			recovered,
			entryStateById: new Map([["deposit-1", { status: "started", lane: "cancellation" }]])
		})

		expect(result.pendingOperations).toEqual([
			{
				id: "deposit-1",
				lane: "cancellation",
				order: 0,
				status: "started",
				cancellable: true,
				timeoutSlot: undefined
			}
		])
		expect(result.activeOperation).toBeNull()
		expect(result.activeCancellationOperation).toBe("deposit-1")
	})

	it("matches a live started operation by transaction hash when the recovery id differs", () => {
		const pending = [
			actionState({
				id: "recovered-id",
				index: 1,
				date: "2026-03-24T00:00:00Z",
				cancellable: true
			})
		]

		const result = matchRecoveryOperationIds({
			actionStates: pending,
			candidates: [
				{
					id: "bridgeOperation-live-id",
					status: "started",
					transactionHash: "recovered-id-hash"
				}
			]
		})

		expect(result.get("recovered-id")).toBe("bridgeOperation-live-id")
	})
})
