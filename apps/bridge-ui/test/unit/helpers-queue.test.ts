import { describe, expect, it } from "vitest"
import { formatQueueMetadata, queueTitleForDirection, sortByQueueOrder } from "../../app/helpers"

describe("formatQueueMetadata", () => {
	it("includes submitted datetime and remaining timeout for recovered deposits", () => {
		expect(
			formatQueueMetadata(
				{
					direction: "deposit",
					timeoutSlot: "63540",
					currentSlot: "63538",
					transaction: { date: new Date("2026-03-24T15:15:00Z") }
				},
				{ timeZone: "UTC" }
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
				{ timeZone: "UTC" }
			)
		).toEqual(["Submitted Mar 24, 2026, 3:15 PM", "Times out in 3 min"])
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
				{ timeZone: "UTC" }
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
				{ timeZone: "UTC" }
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
})
