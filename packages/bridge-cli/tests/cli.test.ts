import { describe, expect, it } from "vitest"
import { createBridgeCli } from "../src/cli"

describe("cli skeleton", () => {
	it("exposes the planned top-level command groups", () => {
		const cli = createBridgeCli()

		expect(Object.keys(cli.subCommands ?? {}).sort()).toEqual([
			"bridge",
			"deposit",
			"doctor",
			"operation",
			"tui",
			"withdrawal"
		])
	})
})
