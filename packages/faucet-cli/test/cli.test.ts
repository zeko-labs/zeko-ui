import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CommandOutput } from "../src/output"

type CliModule = typeof import("../src/cli")
type CommandDefinition = {
	subCommands: {
		claim: {
			run: ({ args }: { args: Record<string, unknown> }) => Promise<void>
		}
		whoami: {
			run: ({ args }: { args: Record<string, unknown> }) => Promise<void>
		}
	}
}

const runMainMock = vi.fn()
const runClaimCommandMock = vi.fn()
const runWhoAmICommandMock = vi.fn()
const toCliErrorMock = vi.fn()
const printSuccessMock = vi.fn()
const printErrorMock = vi.fn()
const markSuccessMock = vi.fn()
const applyExitCodeMock = vi.fn()
let capturedMain: CommandDefinition | undefined

const loadCliModule = async (): Promise<CliModule> => {
	vi.resetModules()
	capturedMain = undefined

	vi.doMock("citty", () => ({
		defineCommand: (input: CommandDefinition) => {
			capturedMain = input
			return input
		},
		runMain: runMainMock
	}))
	vi.doMock("../src/commands/claim", () => ({
		runClaimCommand: runClaimCommandMock
	}))
	vi.doMock("../src/commands/whoami", () => ({
		runWhoAmICommand: runWhoAmICommandMock
	}))
	vi.doMock("../src/errors", async () => {
		const actual = await vi.importActual<typeof import("../src/errors")>("../src/errors")
		return {
			...actual,
			toCliError: toCliErrorMock
		}
	})
	vi.doMock("../src/output", () => ({
		applyExitCode: applyExitCodeMock,
		markSuccess: markSuccessMock,
		printError: printErrorMock,
		printSuccess: printSuccessMock
	}))

	return import("../src/cli")
}

const expectMain = () => {
	expect(capturedMain).toBeDefined()
	return capturedMain as CommandDefinition
}

describe("runCli", () => {
	beforeEach(() => {
		runMainMock.mockReset()
		runClaimCommandMock.mockReset()
		runWhoAmICommandMock.mockReset()
		toCliErrorMock.mockReset()
		printSuccessMock.mockReset()
		printErrorMock.mockReset()
		markSuccessMock.mockReset()
		applyExitCodeMock.mockReset()
	})

	it("delegates to citty's runMain", async () => {
		runMainMock.mockResolvedValueOnce("done")
		const module = await loadCliModule()

		await expect(module.runCli()).resolves.toBe("done")
		expect(runMainMock).toHaveBeenCalledWith(expectMain())
	})

	it("prints successful claim command output", async () => {
		const result: CommandOutput = {
			human: "ok",
			json: {
				success: true
			}
		}
		runClaimCommandMock.mockResolvedValueOnce(result)
		const module = await loadCliModule()

		await module.runCli()
		await expectMain().subCommands.claim.run({
			args: {
				_: ["B62abc"],
				json: true,
				token: "ghp_flag"
			}
		})

		expect(runClaimCommandMock).toHaveBeenCalledWith({
			addressInput: "B62abc",
			extraPositionals: [],
			token: "ghp_flag"
		})
		expect(printSuccessMock).toHaveBeenCalledWith(result, true)
		expect(markSuccessMock).toHaveBeenCalledOnce()
	})

	it("prints claim command errors via the CLI error adapter", async () => {
		const cliError = {
			code: "broken",
			message: "Boom",
			exitCode: 9
		}
		runClaimCommandMock.mockRejectedValueOnce(new Error("boom"))
		toCliErrorMock.mockReturnValueOnce(cliError)
		const module = await loadCliModule()

		await module.runCli()
		await expectMain().subCommands.claim.run({
			args: {
				_: ["B62abc", "extra"],
				json: false,
				token: true
			}
		})

		expect(runClaimCommandMock).toHaveBeenCalledWith({
			addressInput: "B62abc",
			extraPositionals: ["extra"],
			token: undefined
		})
		expect(printErrorMock).toHaveBeenCalledWith(cliError, false)
		expect(applyExitCodeMock).toHaveBeenCalledWith(9)
	})

	it("prints successful whoami output", async () => {
		const result: CommandOutput = {
			human: "ok",
			json: {
				success: true
			}
		}
		runWhoAmICommandMock.mockResolvedValueOnce(result)
		const module = await loadCliModule()

		await module.runCli()
		await expectMain().subCommands.whoami.run({
			args: {
				_: "not-an-array",
				json: false,
				token: "ghp_flag"
			}
		})

		expect(runWhoAmICommandMock).toHaveBeenCalledWith({
			extraPositionals: [],
			token: "ghp_flag"
		})
		expect(printSuccessMock).toHaveBeenCalledWith(result, false)
		expect(markSuccessMock).toHaveBeenCalledOnce()
	})
})
