import { type ChildProcess, execFile, spawn } from "node:child_process"
import { once } from "node:events"
import { createServer as createHttpServer } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { setTimeout as wait } from "node:timers/promises"
import * as v from "valibot"
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

const CliRowsSchema = v.pipe(v.string(), v.parseJson(), v.array(v.record(v.string(), v.unknown())))

const parseCliRows = (stdout: string): Array<Record<string, unknown>> =>
	v.parse(CliRowsSchema, stdout)

const countRows = async (tableName: string): Promise<number> => {
	const result = await runCommand({
		command: "docker",
		args: [
			"exec",
			containerName,
			"psql",
			"-U",
			"postgres",
			"-d",
			"actions",
			"-t",
			"-A",
			"-c",
			`SELECT COUNT(*) FROM ${tableName};`
		]
	})

	return Number(result.stdout.trim())
}

const seedIndexedRows = async (): Promise<void> => {
	await runCommand({
		command: "docker",
		args: [
			"exec",
			containerName,
			"psql",
			"-U",
			"postgres",
			"-d",
			"actions",
			"-c",
			[
				'INSERT INTO outer_actions (after_state, kind, before_state, index, block_height, timestamp, txn_hash, fields, slot_range_lower, slot_range_upper, marked_as_canonical_at) VALUES (\'outer-witness-1\', \'witness\', NULL, 0, 1, NOW(), \'txn-outer-witness\', \'["0","1","2","3","4"]\'::jsonb, 0, 1, NOW());',
				"INSERT INTO witness_actions (after_state, aux) VALUES ('outer-witness-1', 'aux-outer');",
				'INSERT INTO outer_actions (after_state, kind, before_state, index, block_height, timestamp, txn_hash, fields, slot_range_lower, slot_range_upper, marked_as_canonical_at) VALUES (\'outer-commit-1\', \'commit\', \'outer-witness-1\', 1, 2, NOW(), \'txn-outer-commit\', \'["1","2","3","4","5","6","7","8"]\'::jsonb, 1, 2, NOW());',
				"INSERT INTO commit_actions (after_state, ledger, inner_action_state, inner_action_state_length, synchronized_outer_action_state, synchronized_outer_action_state_length) VALUES ('outer-commit-1', 'ledger-1', 'inner-state-1', 1, 'sync-outer-state-1', 1);",
				"INSERT INTO inner_actions (after_state, before_state, index, block_height, timestamp, txn_hash, fields, marked_as_canonical_at, aux) VALUES ('inner-1', NULL, 0, 1, NOW(), 'txn-inner-1', '[\"9\",\"10\"]'::jsonb, NOW(), 'aux-inner');"
			].join(" ")
		]
	})
}

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

	it("rejects unauthenticated control endpoints", async () => {
		const requests = await Promise.all([
			fetch(`${serviceBaseUrl}/status`),
			fetch(`${serviceBaseUrl}/start`, { method: "POST" }),
			fetch(`${serviceBaseUrl}/stop`, { method: "POST" }),
			fetch(`${serviceBaseUrl}/reset`, { method: "POST" }),
			fetch(`${serviceBaseUrl}/rebuild`, { method: "POST" }),
			fetch(`${serviceBaseUrl}/config`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ intervalSeconds: 5 })
			})
		])

		for (const response of requests) {
			expect([401, 403]).toContain(response.status)
		}
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
		const healthRows = parseCliRows(healthCli.stdout)
		expect(healthRows[0]?.check).toBe("health")

		const benchCli = await runCommand({
			command: "node",
			args: [
				"dist/cli.js",
				"action-processing-bench",
				"--iterations",
				"1",
				"--block-count",
				"40",
				"--actions-per-block",
				"8",
				"--fields-per-action",
				"6",
				"--json"
			],
			cwd: serviceDir
		})
		const benchRows = parseCliRows(benchCli.stdout)
		expect(benchRows[0]?.check).toBe("action-processing-bench")
		expect(Number(benchRows[0]?.eventsPerRun)).toBeGreaterThan(0)

		const stressCli = await runCommand({
			command: "node",
			args: [
				"dist/cli.js",
				"action-processing-stress",
				"--duration-seconds",
				"1",
				"--block-count",
				"40",
				"--actions-per-block",
				"8",
				"--fields-per-action",
				"6",
				"--json"
			],
			cwd: serviceDir
		})
		const stressRows = parseCliRows(stressCli.stdout)
		expect(stressRows[0]?.check).toBe("action-processing-stress")
		expect(Number(stressRows[0]?.runs)).toBeGreaterThan(0)

		const stopResponse = await fetch(`${serviceBaseUrl}/stop`, {
			method: "POST",
			headers: authed()
		})
		expect(stopResponse.status).toBe(200)
	}, 180_000)

	it("requires AUTH_TOKEN for reset and clears all indexed tables before restarting", async () => {
		await seedIndexedRows()
		expect(await countRows("outer_actions")).toBe(2)
		expect(await countRows("commit_actions")).toBe(1)
		expect(await countRows("witness_actions")).toBe(1)
		expect(await countRows("inner_actions")).toBe(1)

		const missingAuth = await runCommand({
			command: "node",
			args: ["dist/cli.js", "reset", "--url", serviceBaseUrl, "--json"],
			cwd: serviceDir,
			env: {
				...process.env,
				AUTH_TOKEN: ""
			},
			allowFailure: true
		})
		expect(missingAuth.code).not.toBe(0)
		expect(`${missingAuth.stdout}${missingAuth.stderr}`).toContain("AUTH_TOKEN")

		const resetResult = await runCommand({
			command: "node",
			args: ["dist/cli.js", "reset", "--url", serviceBaseUrl, "--json"],
			cwd: serviceDir,
			env: {
				...process.env,
				AUTH_TOKEN: authToken
			}
		})
		const resetRows = parseCliRows(resetResult.stdout)
		expect(resetRows[0]?.command).toBe("reset")
		expect(resetRows[0]?.isRunning).toBe(true)

		expect(await countRows("outer_actions")).toBe(0)
		expect(await countRows("commit_actions")).toBe(0)
		expect(await countRows("witness_actions")).toBe(0)
		expect(await countRows("inner_actions")).toBe(0)

		const statusResponse = await fetch(`${serviceBaseUrl}/status`, {
			headers: authed()
		})
		expect(statusResponse.status).toBe(200)
		const status = (await statusResponse.json()) as { isRunning?: boolean }
		expect(status.isRunning).toBe(true)
	}, 180_000)

	it("accepts documented kebab-case flags", async () => {
		const port = await allocatePort()
		const baseUrl = `http://127.0.0.1:${port}`
		const server = createHttpServer((_, response) => {
			setTimeout(() => {
				response.writeHead(200, { "content-type": "application/json" })
				response.end(JSON.stringify({ status: "healthy" }))
			}, 50)
		})

		await new Promise<void>((resolveServer, reject) => {
			server.listen(port, "127.0.0.1", () => resolveServer())
			server.on("error", reject)
		})

		try {
			const timedOut = await runCommand({
				command: "node",
				args: ["dist/cli.js", "health", "--url", baseUrl, "--timeout-ms", "10", "--json"],
				cwd: serviceDir,
				allowFailure: true
			})
			expect(timedOut.code).not.toBe(0)
			expect(timedOut.stderr).toContain("timed out after 10ms")

			const succeeded = await runCommand({
				command: "node",
				args: ["dist/cli.js", "health", "--url", baseUrl, "--timeout-ms", "500", "--json"],
				cwd: serviceDir
			})
			const rows = parseCliRows(succeeded.stdout)
			expect(rows[0]?.check).toBe("health")

			const resources = await runCommand({
				command: "node",
				args: [
					"dist/cli.js",
					"resources",
					"--project-id",
					"project",
					"--service-id",
					"service",
					"--duration-seconds",
					"60",
					"--json"
				],
				cwd: serviceDir,
				allowFailure: true
			})
			const resourcesOutput = `${resources.stdout}${resources.stderr}`
			expect(resourcesOutput).toContain("northflank")
			expect(resourcesOutput).not.toContain("project-id and service-id")
		} finally {
			server.close()
			await once(server, "close")
		}
	}, 60_000)
})
