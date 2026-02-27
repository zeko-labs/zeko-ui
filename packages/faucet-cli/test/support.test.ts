import { afterEach, describe, expect, it, vi } from "vitest"
import { CliError, ExitCode, toCliError } from "../src/errors"
import {
	applyExitCode,
	type CommandOutput,
	markSuccess,
	printError,
	printSuccess
} from "../src/output"
import { parseAddress, resolveToken } from "../src/validation"

const expectCliError = (
	callback: () => unknown,
	expected: {
		code: string
		exitCode: number
	}
) => {
	try {
		callback()
		throw new Error("Expected callback to throw")
	} catch (error) {
		expect(error).toMatchObject(expected)
	}
}

describe("errors", () => {
	it("preserves CliError instances", () => {
		const error = new CliError({
			code: "known",
			message: "Known failure",
			exitCode: ExitCode.Auth
		})

		expect(toCliError(error)).toBe(error)
	})

	it("wraps Error instances", () => {
		expect(toCliError(new Error("boom"))).toMatchObject({
			code: "unexpected_error",
			message: "boom",
			exitCode: ExitCode.General
		})
	})

	it("wraps non-Error throwables", () => {
		expect(toCliError({ nope: true })).toMatchObject({
			code: "unexpected_error",
			message: "An unexpected error occurred.",
			exitCode: ExitCode.General,
			details: {
				nope: true
			}
		})
	})
})

describe("output", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		process.exitCode = undefined
	})

	it("prints success output in both formats", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
		const output: CommandOutput = {
			human: "hello",
			json: {
				success: true
			}
		}

		printSuccess(output, false)
		printSuccess(output, true)

		expect(log).toHaveBeenNthCalledWith(1, "hello")
		expect(log).toHaveBeenNthCalledWith(2, '{\n  "success": true\n}')
	})

	it("prints errors in both formats", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
		const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const error = new CliError({
			code: "bad",
			message: "Bad request",
			exitCode: ExitCode.General,
			details: "details"
		})

		printError(error, false)
		printError(error, true)

		expect(errorLog).toHaveBeenCalledWith("Error: Bad request")
		expect(log).toHaveBeenCalledWith(
			'{\n  "success": false,\n  "code": "bad",\n  "message": "Bad request",\n  "details": "details"\n}'
		)
	})

	it("updates the process exit code", () => {
		expect(applyExitCode(7)).toBe(7)
		expect(process.exitCode).toBe(7)
		expect(markSuccess()).toBe(0)
		expect(process.exitCode).toBe(0)
	})
})

describe("validation", () => {
	afterEach(() => {
		delete process.env.GITHUB_TOKEN
	})

	it("parses valid addresses", () => {
		expect(parseAddress("  B62abc123  ")).toBe("B62abc123")
	})

	it("rejects invalid addresses", () => {
		expectCliError(() => parseAddress(" "), {
			code: "invalid_address",
			exitCode: ExitCode.InvalidAddress
		})
	})

	it("prefers explicit tokens over the environment", () => {
		process.env.GITHUB_TOKEN = "env-token"
		expect(resolveToken("  flag-token  ")).toEqual({
			token: "flag-token",
			source: "flag"
		})
	})

	it("falls back to the environment token", () => {
		process.env.GITHUB_TOKEN = " env-token "
		expect(resolveToken()).toEqual({
			token: "env-token",
			source: "env"
		})
	})

	it("throws when no token is available", () => {
		expectCliError(() => resolveToken(), {
			code: "missing_token",
			exitCode: ExitCode.Auth
		})
	})
})
