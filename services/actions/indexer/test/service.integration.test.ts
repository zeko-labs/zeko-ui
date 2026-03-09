import { type ChildProcess, execFile, spawn } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { setTimeout as wait } from "node:timers/promises"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

interface CommandResult {
	code: number
	stdout: string
	stderr: string
}

const serviceDir = resolve(import.meta.dirname, "..")
const repoRoot = resolve(serviceDir, "../../..")
const authToken = "indexer-test-token"
const containerName = `actions-indexer-it-${Date.now()}`
const maxServiceLogChars = 20_000

let servicePort = 0
let dbPort = 0
let dbUrl = ""
let serviceBaseUrl = ""
let serviceProcess: ChildProcess | null = null
let serviceStdout = ""
let serviceStderr = ""

const appendLog = (existing: string, chunk: string): string => {
	const combined = `${existing}${chunk}`
	if (combined.length <= maxServiceLogChars) return combined
	return combined.slice(-maxServiceLogChars)
}

const formatServiceLogs = (): string =>
	`Service stdout:\n${serviceStdout || "<empty>"}\nService stderr:\n${serviceStderr || "<empty>"}`

const allocatePort = async (): Promise<number> =>
	new Promise((resolvePort, reject) => {
		const server = createServer()
		server.listen(0, "127.0.0.1", () => {
			const address = server.address()
			if (!address || typeof address === "string") {
				server.close()
				reject(new Error("Failed to allocate dynamic port"))
				return
			}
			const { port } = address
			server.close((error) => {
				if (error) {
					reject(error)
					return
				}
				resolvePort(port)
			})
		})
		server.on("error", reject)
	})

const runCommand = async ({
	command,
	args,
	cwd,
	env,
	allowFailure = false
}: {
	command: string
	args: string[]
	cwd?: string
	env?: NodeJS.ProcessEnv
	allowFailure?: boolean
}): Promise<CommandResult> =>
	new Promise((resolveCommand, reject) => {
		execFile(
			command,
			args,
			{
				cwd,
				env,
				maxBuffer: 20 * 1024 * 1024
			},
			(error, stdout, stderr) => {
				const errorCode = (error as NodeJS.ErrnoException | null)?.code
				const code =
					error != null && typeof errorCode === "number" ? errorCode : error != null ? 1 : 0

				if (error && !allowFailure) {
					reject(
						new Error(
							[
								`Command failed: ${command} ${args.join(" ")}`,
								`stdout:\n${stdout || "<empty>"}`,
								`stderr:\n${stderr || "<empty>"}`,
								`error: ${error.message}`
							].join("\n")
						)
					)
					return
				}

				resolveCommand({
					code,
					stdout: stdout.toString(),
					stderr: stderr.toString()
				})
			}
		)
	})

const waitForDatabase = async (): Promise<void> => {
	for (let attempt = 0; attempt < 60; attempt++) {
		const check = await runCommand({
			command: "docker",
			args: ["exec", containerName, "pg_isready", "-U", "postgres", "-d", "actions"],
			allowFailure: true
		})
		if (check.code === 0) return
		await wait(1000)
	}
	const logs = await runCommand({
		command: "docker",
		args: ["logs", containerName],
		allowFailure: true
	})
	throw new Error(
		`Postgres container did not become ready in time.\nstdout:\n${logs.stdout || "<empty>"}\nstderr:\n${logs.stderr || "<empty>"}`
	)
}

const startService = async () => {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		PORT: String(servicePort),
		AUTH_TOKEN: authToken,
		DATABASE_URL: dbUrl,
		L1_ARCHIVE_URL: "http://127.0.0.1:1/graphql",
		L2_ARCHIVE_URL: "http://127.0.0.1:1/graphql",
		OUTER_PK: "TEST_OUTER_PK",
		INNER_PK: "TEST_INNER_PK",
		ENVIRONMENT: "test"
	}

	serviceProcess = spawn("node", ["dist/index.js"], {
		cwd: serviceDir,
		env,
		stdio: ["ignore", "pipe", "pipe"]
	})

	serviceProcess?.stdout?.on("data", (chunk) => {
		serviceStdout = appendLog(serviceStdout, chunk.toString())
	})
	serviceProcess?.stderr?.on("data", (chunk) => {
		serviceStderr = appendLog(serviceStderr, chunk.toString())
	})
}

const waitForService = async (): Promise<void> => {
	for (let attempt = 0; attempt < 60; attempt++) {
		if (serviceProcess?.exitCode != null) {
			throw new Error(
				`Indexer service exited early with code ${serviceProcess.exitCode}\n${formatServiceLogs()}`
			)
		}
		try {
			const response = await fetch(`${serviceBaseUrl}/health`)
			if (response.status === 200 || response.status === 503) return
		} catch {
			// wait and retry until server binds
		}
		await wait(1000)
	}
	throw new Error(`Indexer service did not become reachable in time.\n${formatServiceLogs()}`)
}

const authed = (headers: Record<string, string> = {}) => ({
	Authorization: `Bearer ${authToken}`,
	...headers
})

describe("service integration", () => {
	beforeAll(async () => {
		serviceStdout = ""
		serviceStderr = ""
		servicePort = await allocatePort()
		dbPort = await allocatePort()
		dbUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/actions`
		serviceBaseUrl = `http://127.0.0.1:${servicePort}`

		await runCommand({
			command: "docker",
			args: ["info"]
		})

		await runCommand({
			command: "docker",
			args: [
				"run",
				"-d",
				"--rm",
				"--name",
				containerName,
				"-e",
				"POSTGRES_PASSWORD=postgres",
				"-e",
				"POSTGRES_DB=actions",
				"-p",
				`${dbPort}:5432`,
				"postgres:16-alpine"
			]
		})

		await waitForDatabase()

		await runCommand({
			command: "pnpm",
			args: ["--filter", "@zeko/actions-api", "exec", "drizzle-kit", "push"],
			cwd: repoRoot,
			env: {
				...process.env,
				DATABASE_URL: dbUrl
			}
		})

		await runCommand({
			command: "moon",
			args: ["run", "actions-indexer:build", "-f"],
			cwd: repoRoot
		})

		await startService()
		await waitForService()
	}, 300_000)

	afterAll(async () => {
		if (serviceProcess && serviceProcess.exitCode == null) {
			serviceProcess.kill("SIGTERM")
			await Promise.race([once(serviceProcess, "exit"), wait(10_000)])
		}

		await runCommand({
			command: "docker",
			args: ["rm", "-f", containerName],
			allowFailure: true
		})
	}, 60_000)

	it("serves health and lifecycle endpoints", async () => {
		const healthResponse = await fetch(`${serviceBaseUrl}/health`)
		expect([200, 503]).toContain(healthResponse.status)
		const health = (await healthResponse.json()) as { service?: { name?: string } }
		expect(health.service?.name).toBe("actions-indexer")

		await fetch(`${serviceBaseUrl}/stop`, {
			method: "POST",
			headers: authed()
		})

		const statusAfterStop = await fetch(`${serviceBaseUrl}/status`, {
			headers: authed()
		})
		expect(statusAfterStop.status).toBe(200)
		const statusStopped = (await statusAfterStop.json()) as { isRunning?: boolean }
		expect(statusStopped.isRunning).toBe(false)

		const configResponse = await fetch(`${serviceBaseUrl}/config`, {
			method: "POST",
			headers: authed({ "Content-Type": "application/json" }),
			body: JSON.stringify({ intervalSeconds: 5 })
		})
		expect(configResponse.status).toBe(200)

		const startResponse = await fetch(`${serviceBaseUrl}/start`, {
			method: "POST",
			headers: authed()
		})
		expect(startResponse.status).toBe(200)

		const statusRunningResponse = await fetch(`${serviceBaseUrl}/status`, {
			headers: authed()
		})
		const statusRunning = (await statusRunningResponse.json()) as { isRunning?: boolean }
		expect(statusRunning.isRunning).toBe(true)

		const stopResponse = await fetch(`${serviceBaseUrl}/stop`, {
			method: "POST",
			headers: authed()
		})
		expect(stopResponse.status).toBe(200)
	}, 120_000)

	it("rejects unauthenticated lifecycle access", async () => {
		const statusResponse = await fetch(`${serviceBaseUrl}/status`)
		expect([401, 403]).toContain(statusResponse.status)
	})

	it("runs CLI checks against the running service", async () => {
		const startResponse = await fetch(`${serviceBaseUrl}/start`, {
			method: "POST",
			headers: authed()
		})
		expect(startResponse.status).toBe(200)

		const healthCli = await runCommand({
			command: "node",
			args: ["dist/cli.js", "health", "--url", serviceBaseUrl, "--timeout-ms", "8000", "--json"],
			cwd: serviceDir
		})
		const healthRows = JSON.parse(healthCli.stdout) as Array<Record<string, unknown>>
		expect(healthRows[0]?.check).toBe("health")

		const benchCli = await runCommand({
			command: "node",
			args: [
				"dist/cli.js",
				"action-processing-bench",
				"--iterations",
				"1",
				"--blockCount",
				"40",
				"--actionsPerBlock",
				"8",
				"--fieldsPerAction",
				"6",
				"--json"
			],
			cwd: serviceDir
		})
		const benchRows = JSON.parse(benchCli.stdout) as Array<Record<string, unknown>>
		expect(benchRows[0]?.check).toBe("action-processing-bench")
		expect(Number(benchRows[0]?.eventsPerRun)).toBeGreaterThan(0)

		const stressCli = await runCommand({
			command: "node",
			args: [
				"dist/cli.js",
				"action-processing-stress",
				"--durationSeconds",
				"1",
				"--blockCount",
				"40",
				"--actionsPerBlock",
				"8",
				"--fieldsPerAction",
				"6",
				"--json"
			],
			cwd: serviceDir
		})
		const stressRows = JSON.parse(stressCli.stdout) as Array<Record<string, unknown>>
		expect(stressRows[0]?.check).toBe("action-processing-stress")
		expect(Number(stressRows[0]?.runs)).toBeGreaterThan(0)

		const stopResponse = await fetch(`${serviceBaseUrl}/stop`, {
			method: "POST",
			headers: authed()
		})
		expect(stopResponse.status).toBe(200)
	}, 180_000)
})
