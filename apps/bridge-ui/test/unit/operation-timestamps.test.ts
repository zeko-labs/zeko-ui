import { describe, expect, it } from "vitest"
import {
	formatOperationDate,
	normalizeOperationTimestamp,
	sortOperationTimestampsDesc
} from "../../machines/operationTimestamps"

describe("normalizeOperationTimestamp", () => {
	it("parses epoch-millisecond strings from the bridge sdk", () => {
		expect(normalizeOperationTimestamp("1700000000000")).toBe(1700000000000)
	})

	it("parses ISO timestamps", () => {
		expect(normalizeOperationTimestamp("2024-01-01T00:00:00.000Z")).toBe(1704067200000)
	})

	it("returns null for invalid values", () => {
		expect(normalizeOperationTimestamp("not-a-date")).toBeNull()
		expect(normalizeOperationTimestamp("")).toBeNull()
		expect(normalizeOperationTimestamp(null)).toBeNull()
	})
})

describe("formatOperationDate", () => {
	it("returns Unknown for missing timestamps", () => {
		expect(formatOperationDate(null, "en-US")).toBe("Unknown")
	})

	it("formats date with hour and minute", () => {
		expect(formatOperationDate(new Date(2026, 6, 1, 14, 5).getTime(), "en-US")).toBe(
			"7/1/2026, 14:05"
		)
	})
})

describe("sortOperationTimestampsDesc", () => {
	it("sorts valid timestamps before null timestamps", () => {
		expect(sortOperationTimestampsDesc(null, 1700000000000)).toBe(1)
		expect(sortOperationTimestampsDesc(1700000000000, null)).toBe(-1)
		expect(sortOperationTimestampsDesc(null, null)).toBe(0)
	})
})
