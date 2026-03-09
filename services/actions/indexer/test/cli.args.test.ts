import { describe, expect, it } from "vitest"
import { readCliBooleanArg, readCliNumberArg } from "../src/cli/args"

describe("cli arg normalization", () => {
	it("keeps bare boolean flags as true", () => {
		const value = readCliBooleanArg(
			{ preferWorker: true },
			["preferWorker", "prefer-worker"],
			false
		)
		expect(value).toBe(true)
	})

	it("parses string boolean variants", () => {
		expect(readCliBooleanArg({ preferWorker: "true" }, ["preferWorker"], false)).toBe(true)
		expect(readCliBooleanArg({ preferWorker: "1" }, ["preferWorker"], false)).toBe(true)
		expect(readCliBooleanArg({ preferWorker: "false" }, ["preferWorker"], true)).toBe(false)
	})

	it("parses numeric args with fallback", () => {
		expect(readCliNumberArg({ iterations: "3" }, ["iterations"], 1)).toBe(3)
		expect(readCliNumberArg({ iterations: "not-a-number" }, ["iterations"], 2)).toBe(2)
	})
})
