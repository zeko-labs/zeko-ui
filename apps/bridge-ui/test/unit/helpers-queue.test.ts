import { afterEach, describe, expect, it, vi } from "vitest"
import {
	deriveBridgeQueues,
	formatQueueMetadata,
	queueTitleForDirection,
	sortByQueueOrder
} from "../../app/helpers"

describe("formatQueueMetadata", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("includes submitted datetime and remaining timeout for recovered deposits", () => {
		expect(
			formatQueueMetadata(
				{
					direction: "deposit",
					timeoutSlot: "63540",
					currentSlot: "63538",
					transaction: { date: new Date("2026-03-24T15:15:00Z") }
				},
				{ locale: "en-US", timeZone: "UTC" }
			)
		).toEqual(["Submitted Mar 24, 2026, 3:15 PM", "Times out in 6 min"])
	})

	it("falls back to the locally selected timeout window before submission", () => {
		expect(
			formatQueueMetadata(
				{
					direction: "deposit",
					timeoutSlots: 1,
					transaction: { date: new Date("2026-03-24T15:15:00Z") }
				},
				{ locale: "en-US", timeZone: "UTC" }
			)
		).toEqual(["Submitted Mar 24, 2026, 3:15 PM", "Times out in 3 min"])
	})

	it("uses the browser locale when no locale option is provided", () => {
		vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR")

		expect(
			formatQueueMetadata(
				{
					direction: "withdrawal",
					transaction: { date: new Date("2026-03-24T15:15:00Z") }
				},
				{ timeZone: "UTC" }
			)
		).toEqual(["Submitted 24 mars 2026, 15:15"])
	})

	it("falls back when the browser reports an invalid locale tag", () => {
		vi.spyOn(navigator, "language", "get").mockReturnValue("en-US@posix")

		expect(() =>
			formatQueueMetadata(
				{
					direction: "withdrawal",
					transaction: { date: new Date("2026-03-24T15:15:00Z") }
				},
				{ timeZone: "UTC" }
			)
		).not.toThrow()
	})

	it("shows timed out only when the deposit is cancellable", () => {
		expect(
			formatQueueMetadata({
				direction: "deposit",
				cancellable: true,
				timeoutSlot: "63540",
				currentSlot: "63540",
				transaction: { date: new Date("2026-03-24T15:15:00Z") }
			})
		).toContain("Timed out")
	})

	it("omits timed out copy for expired deposits that are not cancellable", () => {
		expect(
			formatQueueMetadata(
				{
					direction: "deposit",
					cancellable: false,
					timeoutSlot: "63540",
					currentSlot: "63540",
					transaction: { date: new Date("2026-03-24T15:15:00Z") }
				},
				{ locale: "en-US", timeZone: "UTC" }
			)
		).toEqual(["Submitted Mar 24, 2026, 3:15 PM"])
	})

	it("does not show timeout metadata for withdrawals", () => {
		expect(
			formatQueueMetadata(
				{
					direction: "withdrawal",
					timeoutSlot: "63540",
					transaction: { date: new Date("2026-03-24T15:15:00Z") }
				},
				{ locale: "en-US", timeZone: "UTC" }
			)
		).toEqual(["Submitted Mar 24, 2026, 3:15 PM"])
	})

	it("omits submitted metadata when the transaction date is unknown", () => {
		expect(
			formatQueueMetadata({
				direction: "withdrawal",
				transaction: {}
			})
		).toEqual([])
	})

	it("renders submitted metadata from normalized timestamps", () => {
		expect(
			formatQueueMetadata(
				{
					direction: "withdrawal",
					transaction: { timestampMs: Date.parse("2026-03-24T15:15:00Z") }
				},
				{ locale: "en-US", timeZone: "UTC" }
			)
		).toEqual(["Submitted Mar 24, 2026, 3:15 PM"])
	})

	it("uses explicit route-specific queue titles", () => {
		expect(queueTitleForDirection("deposit")).toBe("Deposit Queue")
		expect(queueTitleForDirection("withdrawal")).toBe("Withdrawal Queue")
	})

	it("sorts queued cards by their explicit queue order", () => {
		expect(
			sortByQueueOrder([
				{ id: "second", order: 2 },
				{ id: "first", order: 1 },
				{ id: "third", order: 3 }
			]).map((item) => item.id)
		).toEqual(["first", "second", "third"])
	})

	it("keeps cancellable deposits out of the main lane queues", () => {
		const result = deriveBridgeQueues([
			{
				id: "deposit-active",
				order: 0,
				status: "started",
				lane: "main",
				direction: "deposit",
				operation: "deposit-active"
			},
			{
				id: "deposit-next",
				order: 1,
				status: "paused",
				lane: "main",
				direction: "deposit",
				operation: "deposit-next"
			},
			{
				id: "withdrawal-next",
				order: 2,
				status: "paused",
				lane: "main",
				direction: "withdrawal",
				operation: "withdrawal-next"
			},
			{
				id: "deposit-cancellable",
				order: 0,
				status: "paused",
				lane: "cancellation",
				direction: "deposit",
				operation: "deposit-cancellable"
			},
			{
				id: "deposit-complete",
				order: 3,
				status: "completed",
				lane: "main",
				direction: "deposit",
				operation: "deposit-complete"
			}
		])

		expect(result.currentMainOperation).toBe("deposit-active")
		expect(result.depositQueue).toEqual(["deposit-next"])
		expect(result.withdrawalQueue).toEqual(["withdrawal-next"])
		expect(result.cancellableOperations).toEqual(["deposit-cancellable"])
		expect(result.completed.map((item) => item.id)).toEqual(["deposit-complete"])
	})

	it("returns empty main-lane queues when only cancellable deposits remain", () => {
		const result = deriveBridgeQueues([
			{
				id: "deposit-cancellable",
				order: 0,
				status: "started",
				lane: "cancellation",
				direction: "deposit",
				operation: "deposit-cancellable"
			}
		])

		expect(result.currentMainOperation).toBeNull()
		expect(result.depositQueue).toEqual([])
		expect(result.withdrawalQueue).toEqual([])
		expect(result.cancellableOperations).toEqual(["deposit-cancellable"])
	})
})
