import { readFileSync } from "node:fs"
import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const BIN = resolve(import.meta.dirname, "../target/release/zeko-faucet")
const PACKAGE_VERSION = JSON.parse(
	readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8")
).version as string
const VALID_ADDRESS = "B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF"

const run = (...args: string[]) =>
	new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
		const child = spawn(BIN, args, { env: { ...process.env, GITHUB_TOKEN: "" } })

		const stdout: Buffer[] = []
		const stderr: Buffer[] = []

		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk))

		child.on("close", (code) => {
			resolve({
				stdout: Buffer.concat(stdout).toString(),
				stderr: Buffer.concat(stderr).toString(),
				exitCode: code ?? 1
			})
		})
	})

const parseJson = (text: string) => JSON.parse(text.trim()) as Record<string, unknown>

describe("integration: help and version", () => {
	it("--help exits 0 and lists both subcommands", async () => {
		const { stdout, exitCode } = await run("--help")
		expect(exitCode).toBe(0)
		expect(stdout).toContain("claim")
		expect(stdout).toContain("whoami")
	})

	it("--version exits 0 and contains a version string", async () => {
		const { stdout, exitCode } = await run("--version")
		expect(exitCode).toBe(0)
		expect(stdout).toMatch(/\d+\.\d+\.\d+/)
	})

	it("--version matches the package version", async () => {
		const { stdout, exitCode } = await run("--version")
		expect(exitCode).toBe(0)
		expect(stdout.trim()).toBe(`zeko-faucet ${PACKAGE_VERSION}`)
	})

	it("claim --help exits 0 and describes the claim command", async () => {
		const { stdout, exitCode } = await run("claim", "--help")
		expect(exitCode).toBe(0)
		expect(stdout.toLowerCase()).toContain("claim faucet tokens")
	})

	it("whoami --help exits 0 and describes the whoami command", async () => {
		const { stdout, exitCode } = await run("whoami", "--help")
		expect(exitCode).toBe(0)
		expect(stdout.toLowerCase()).toContain("verify the current github token")
	})
})

describe("integration: error cases", () => {
	it("claim with an invalid address exits with invalid_address", async () => {
		const { stdout, exitCode } = await run("claim", "abc123", "--token", "ghp_xxx", "--json")
		expect(exitCode).toBe(4)
		const json = parseJson(stdout)
		expect(json.success).toBe(false)
		expect(json.code).toBe("invalid_address")
	})

	it("claim with no address and no token exits non-zero", async () => {
		const { exitCode } = await run("claim")
		expect(exitCode).not.toBe(0)
	})

	it("claim with invalid token returns JSON with success: false", async () => {
		const { stdout, exitCode } = await run("claim", VALID_ADDRESS, "--token", "invalid", "--json")
		expect(exitCode).not.toBe(0)
		const json = parseJson(stdout)
		expect(json.success).toBe(false)
	})

	it("whoami with invalid token returns JSON with success: false", async () => {
		const { stdout, exitCode } = await run("whoami", "--token", "invalid", "--json")
		expect(exitCode).not.toBe(0)
		const json = parseJson(stdout)
		expect(json.success).toBe(false)
	})

	it("claim with extra positional args exits 1 with invalid_arguments", async () => {
		const { stdout, exitCode } = await run(
			"claim",
			VALID_ADDRESS,
			"extra",
			"--token",
			"ghp_xxx",
			"--json"
		)
		expect(exitCode).toBe(1)
		const json = parseJson(stdout)
		expect(json.success).toBe(false)
		expect(json.code).toBe("invalid_arguments")
	})

	it("whoami with unexpected positional args exits 1 with invalid_arguments", async () => {
		const { stdout, exitCode } = await run("whoami", "unexpected", "--token", "ghp_xxx", "--json")
		expect(exitCode).toBe(1)
		const json = parseJson(stdout)
		expect(json.success).toBe(false)
		expect(json.code).toBe("invalid_arguments")
	})
})
