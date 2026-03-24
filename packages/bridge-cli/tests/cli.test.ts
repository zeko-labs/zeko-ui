import { describe, expect, it } from "vitest"
import { createBridgeCli } from "../src/cli"
import type { CommandDef } from "citty"

const resolveSubCommands = async (subCommands: unknown): Promise<Record<string, unknown>> => {
	if (typeof subCommands === "function") {
		return resolveSubCommands(await subCommands())
	}

	return typeof subCommands === "object" && subCommands !== null
		? (subCommands as Record<string, unknown>)
		: {}
}

const resolveCommand = async (command: unknown): Promise<CommandDef | undefined> => {
	if (typeof command === "function") {
		return resolveCommand(await command())
	}
	if (command && typeof (command as Promise<CommandDef>).then === "function") {
		return resolveCommand(await command)
	}

	return typeof command === "object" && command !== null ? (command as CommandDef) : undefined
}

describe("cli skeleton", () => {
	it("exposes the planned top-level command groups", async () => {
		const cli = createBridgeCli()
		const subCommands = await resolveSubCommands(cli.subCommands)

		expect(Object.keys(subCommands).sort()).toEqual([
			"bridge",
			"deposit",
			"doctor",
			"operation",
			"tui",
			"withdrawal"
		])
	})

	it("keeps bridge as the default high-level command without a public wait flag", async () => {
		const cli = createBridgeCli()
		const subCommands = await resolveSubCommands(cli.subCommands)
		const bridge = await resolveCommand(subCommands.bridge)

		expect(bridge?.args).toBeDefined()
		expect(bridge?.args).not.toHaveProperty("wait")
	})
})
