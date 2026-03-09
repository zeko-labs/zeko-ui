import { spawn } from "node:child_process"

export interface NorthflankMetricsInput {
	projectId: string
	serviceId: string
	durationSeconds: number
}

export interface NorthflankResourcesResult {
	cpuPercent: number | null
	memoryMb: number | null
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

const parseMetrics = (raw: unknown): { cpuPercent: number | null; memoryMb: number | null } => {
	const cpuValues: number[] = []
	const memoryValues: number[] = []
	collectValues(raw, "root", cpuValues, memoryValues)
	const cpuPercent = cpuValues.length ? cpuValues.at(-1) ?? null : null
	const memoryMb = memoryValues.length ? memoryValues.at(-1) ?? null : null
	return { cpuPercent, memoryMb }
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
		throw new Error(
			`northflank command failed (${exitCode}): ${stderr.trim() || stdout.trim() || command.join(" ")}`
		)
	}

	let raw: unknown
	try {
		raw = JSON.parse(stdout)
	} catch {
		throw new Error(`northflank command returned invalid JSON: ${stdout.slice(0, 300)}`)
	}

	const parsed = parseMetrics(raw)

	return {
		...parsed,
		raw,
		command
	}
}
