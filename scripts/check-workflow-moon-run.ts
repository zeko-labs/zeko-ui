import { execFileSync } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const WORKSPACE_ROOT = fileURLToPath(new URL("..", import.meta.url))
const WORKFLOWS_DIR = join(WORKSPACE_ROOT, ".github", "workflows")
const MOON_RUN_PATTERN = /\bmoon\s+run\b/
const MOON_RUN_TARGET_PATTERN =
	/\bmoon\s+run\s+(?:(?:-[\w-]+)(?:[=\s]\S+)?\s+)*["']?([\w-]+:[\w-]+)["']?/

type JsonRecord = Record<string, unknown>

export type WorkflowFile = {
	path: string
	contents: string
}

export type WorkflowMoonRunViolation = {
	command: string
	line: number
	reason: string
	target: string
	workflowPath: string
}

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value)

const findMoonRunTarget = (line: string) => line.match(MOON_RUN_TARGET_PATTERN)?.[1]

export const findWorkflowMoonRunViolations = (
	workflows: WorkflowFile[],
	taskRunInCiByTarget: ReadonlyMap<string, boolean>
) =>
	workflows.flatMap((workflow) =>
		workflow.contents.split("\n").flatMap((line, index): WorkflowMoonRunViolation[] => {
			if (!MOON_RUN_PATTERN.test(line)) {
				return []
			}

			const lineNumber = index + 1
			const target = findMoonRunTarget(line)

			if (!target) {
				return [
					{
						command: line.trim(),
						line: lineNumber,
						reason: "moon run target is not a literal <project>:<task>",
						target: "<unknown>",
						workflowPath: workflow.path
					}
				]
			}

			const taskRunInCi = taskRunInCiByTarget.get(target)

			if (taskRunInCi === true) {
				return []
			}

			return [
				{
					command: line.trim(),
					line: lineNumber,
					reason:
						taskRunInCi == null
							? "Moon target was not found in task metadata"
							: "Moon target is not marked runInCI",
					target,
					workflowPath: workflow.path
				}
			]
		})
	)

export const readWorkflowFiles = async (workflowsDir = WORKFLOWS_DIR): Promise<WorkflowFile[]> => {
	const entries = await readdir(workflowsDir, { withFileTypes: true })
	const workflowNames = entries
		.filter((entry) => entry.isFile() && /\.(ya?ml)$/.test(entry.name))
		.map((entry) => entry.name)
		.sort()

	return Promise.all(
		workflowNames.map(async (name) => ({
			path: join(".github", "workflows", name),
			contents: await readFile(join(workflowsDir, name), "utf8")
		}))
	)
}

export const readMoonTaskRunInCiByTarget = (workspaceRoot = WORKSPACE_ROOT) => {
	const output = execFileSync("moon", ["query", "tasks"], {
		cwd: workspaceRoot,
		encoding: "utf8"
	})
	const parsed = JSON.parse(output) as unknown

	if (!isRecord(parsed) || !isRecord(parsed.tasks)) {
		throw new Error("Unable to read Moon task metadata.")
	}

	return new Map(
		Object.values(parsed.tasks).flatMap((projectTasks) => {
			if (!isRecord(projectTasks)) {
				return []
			}

			return Object.values(projectTasks).flatMap((task) => {
				if (
					!isRecord(task) ||
					typeof task.target !== "string" ||
					!isRecord(task.options) ||
					typeof task.options.runInCI !== "boolean"
				) {
					return []
				}

				return [[task.target, task.options.runInCI] as const]
			})
		})
	)
}

export const assertWorkflowsUseCiRunnableMoonRunTargets = async () => {
	const violations = findWorkflowMoonRunViolations(
		await readWorkflowFiles(),
		readMoonTaskRunInCiByTarget()
	)

	if (violations.length === 0) {
		return
	}

	throw new Error(
		[
			"GitHub Actions workflows must not use `moon run` for workflow-only tasks.",
			"Use `moon exec --ignore-ci-checks <project>:<task>` for tasks that are intentionally outside generic `moon ci`.",
			"",
			...violations.map(
				(violation) =>
					`${violation.workflowPath}:${violation.line} ${violation.target}: ${violation.reason}\n  ${violation.command}`
			)
		].join("\n")
	)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	assertWorkflowsUseCiRunnableMoonRunTargets().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	})
}
