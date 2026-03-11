import { spawn } from "node:child_process"
import * as v from "valibot"

export interface NorthflankMetricsInput {
	projectId: string
	serviceId: string
	durationSeconds: number
}

export interface NorthflankLogsInput {
	projectId: string
	serviceId: string
	durationSeconds: number
	lineLimit?: number
	tail?: boolean
	types?: string[]
	containerId?: string
	deploymentId?: string
}

export interface NorthflankResourcesResult {
	cpuPercent: number | null
	memoryPercent: number | null
	raw: unknown
	command: string[]
}

export function buildNorthflankMetricsArgs({
	projectId,
	serviceId,
	durationSeconds
}: NorthflankMetricsInput): string[] {
	return [
		"get",
		"service",
		"metrics",
		"--project",
		projectId,
		"--service",
		serviceId,
		"-t",
		"cpu",
		"-t",
		"memory",
		"--duration",
		String(durationSeconds),
		"-o",
		"json"
	]
}

export function buildNorthflankLogsArgs({
	projectId,
	serviceId,
	durationSeconds,
	lineLimit,
	tail = true,
	types = ["runtime"],
	containerId,
	deploymentId
}: NorthflankLogsInput): string[] {
	const args = ["get", "service", "logs", "--project", projectId, "--service", serviceId]

	if (containerId) {
		args.push("--container", containerId)
	}

	if (deploymentId) {
		args.push("--deployment", deploymentId)
	}

	for (const type of types) {
		args.push("-t", type)
	}

	args.push("--duration", String(durationSeconds))

	if (lineLimit && lineLimit > 0) {
		args.push("-l", String(lineLimit))
	}

	if (tail) {
		args.push("-f")
	}

	return args
}

const tryNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string") {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : null
	}
	return null
}

const collectValues = (
	input: unknown,
	path: string,
	cpuValues: number[],
	memoryValues: number[]
): void => {
	if (Array.isArray(input)) {
		for (const item of input) collectValues(item, path, cpuValues, memoryValues)
		return
	}

	if (input && typeof input === "object") {
		for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
			collectValues(value, `${path}.${key}`.toLowerCase(), cpuValues, memoryValues)
		}
		return
	}

	const numeric = tryNumber(input)
	if (numeric == null) return
	if (path.includes("cpu")) cpuValues.push(numeric)
	if (path.includes("memory") || path.includes("ram")) memoryValues.push(numeric)
}

export const parseMetrics = (
	raw: unknown
): { cpuPercent: number | null; memoryPercent: number | null } => {
	const cpuValues: number[] = []
	const memoryValues: number[] = []
	collectValues(raw, "root", cpuValues, memoryValues)
	const cpuPercent = cpuValues.length ? cpuValues.at(-1) ?? null : null
	const memoryPercent = memoryValues.length ? memoryValues.at(-1) ?? null : null
	return { cpuPercent, memoryPercent }
}

export async function runNorthflankResources({
	projectId,
	serviceId,
	durationSeconds,
	northflankExecutable = "northflank"
}: NorthflankMetricsInput & { northflankExecutable?: string }): Promise<NorthflankResourcesResult> {
	const metricsArgs = buildNorthflankMetricsArgs({ projectId, serviceId, durationSeconds })
	const command = ["pnpm", "exec", northflankExecutable, ...metricsArgs]
	const process = spawn(command[0], command.slice(1), { stdio: ["ignore", "pipe", "pipe"] })
	const [stdout, stderr, exitCode] = await new Promise<[string, string, number]>(
		(resolve, reject) => {
			let stdoutBuffer = ""
			let stderrBuffer = ""

			process.stdout.on("data", (chunk: Buffer | string) => {
				stdoutBuffer += chunk.toString()
			})

			process.stderr.on("data", (chunk: Buffer | string) => {
				stderrBuffer += chunk.toString()
			})

			process.on("error", (error) => {
				reject(error)
			})

			process.on("close", (code) => {
				resolve([stdoutBuffer, stderrBuffer, code ?? 1])
			})
		}
	)

	if (exitCode !== 0) {
		const message = stderr.trim() || stdout.trim() || command.join(" ")
		if (message.includes("No CLI context present")) {
			throw new Error(
				`northflank command failed (${exitCode}): ${message}. Run 'pnpm exec northflank login' in services/actions/indexer first.`
			)
		}
		throw new Error(`northflank command failed (${exitCode}): ${message}`)
	}

	const parsedOutput = v.safeParse(v.pipe(v.string(), v.parseJson(), v.unknown()), stdout)
	if (!parsedOutput.success) {
		throw new Error(`northflank command returned invalid JSON: ${stdout.slice(0, 300)}`)
	}

	const raw = parsedOutput.output

	const parsed = parseMetrics(raw)

	return {
		...parsed,
		raw,
		command
	}
}

export async function runNorthflankLogs({
	projectId,
	serviceId,
	durationSeconds,
	lineLimit,
	tail = true,
	types = ["runtime"],
	containerId,
	deploymentId,
	northflankExecutable = "northflank"
}: NorthflankLogsInput & { northflankExecutable?: string }): Promise<void> {
	const logArgs = buildNorthflankLogsArgs({
		projectId,
		serviceId,
		durationSeconds,
		lineLimit,
		tail,
		types,
		containerId,
		deploymentId
	})
	const command = ["pnpm", "exec", northflankExecutable, ...logArgs]
	const childProcess = spawn(command[0], command.slice(1), { stdio: "inherit" })
	let interrupted = false

	const handleInterrupt = (signal: NodeJS.Signals) => {
		interrupted = true
		childProcess.kill(signal)
	}

	const handleSigint = () => handleInterrupt("SIGINT")
	const handleSigterm = () => handleInterrupt("SIGTERM")
	globalThis.process.once("SIGINT", handleSigint)
	globalThis.process.once("SIGTERM", handleSigterm)

	const outcome = await (async () => {
		try {
			return await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
				(resolve, reject) => {
					childProcess.on("error", (error) => {
						reject(error)
					})

					childProcess.on("close", (code, signal) => {
						resolve({ code, signal })
					})
				}
			)
		} finally {
			globalThis.process.off("SIGINT", handleSigint)
			globalThis.process.off("SIGTERM", handleSigterm)
		}
	})()

	if (interrupted || outcome.signal === "SIGINT" || outcome.signal === "SIGTERM") {
		return
	}

	const exitCode = outcome.code ?? 1

	if (exitCode !== 0) {
		throw new Error(
			`northflank logs command failed (${exitCode}). Run 'pnpm exec northflank login' in services/actions/indexer first if needed.`
		)
	}
}
