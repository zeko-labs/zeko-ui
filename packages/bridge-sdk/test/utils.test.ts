import { UInt32 } from "o1js"
import { describe, expect, it } from "vitest"
import { uint32Max } from "../src/utils"

describe("uint32Max", () => {
	it("returns the larger UInt32 value", () => {
		expect(uint32Max(UInt32.from(1), UInt32.from(3)).toBigint()).toBe(3n)
		expect(uint32Max(UInt32.from(5), UInt32.from(2)).toBigint()).toBe(5n)
	})
})
