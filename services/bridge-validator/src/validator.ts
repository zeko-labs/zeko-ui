import { spawn } from "node:child_process"
import type { BridgeValidatorRoute } from "./routes"
import type { BridgeCliJsonResult, CommandExecutionResult } from "./types"

export class BridgeValidationError extends Error {
	constructor(
		message: string,
		readonly stage: "command" | "json" | "result",
		readonly exitCode?: number,
		readonly stdout = "",
		readonly stderr = ""
	) {
		super(message)
	}
}

type RunCommand = (input: {
	command: string
	args: string[]
	env: NodeJS.ProcessEnv
}) => Promise<CommandExecutionResult>

export const runCommand: RunCommand = ({ command, args, env }) =>
	new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			env,
			stdio: ["ignore", "pipe", "pipe"]
		})
		let stdout = ""
		let stderr = ""

		child.stdout.on("data", (chunk) => {
			stdout += String(chunk)
		})
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk)
		})
		child.on("error", reject)
		child.on("close", (code) => {
			resolve({
				exitCode: code ?? 1,
				stdout,
				stderr
			})
		})
	})

export const buildBridgeInvocation = ({
	route,
	cliVersion
}: {
	route: BridgeValidatorRoute
	cliVersion: string
}) => ({
	command: "npx",
	args: [
		"-y",
		`@zeko-labs/bridge-cli@${cliVersion}`,
		"bridge",
		"--from",
		route.from,
		"--to",
		route.to,
		"--amount",
		"1",
		"--json"
	]
})

export const parseBridgeJson = (stdout: string): BridgeCliJsonResult => {
	try {
		return JSON.parse(stdout.trim()) as BridgeCliJsonResult
	} catch (error) {
		throw new BridgeValidationError(
			`Failed to parse bridge JSON output: ${error instanceof Error ? error.message : String(error)}`,
			"json",
			undefined,
			stdout
		)
	}
}

export const validatePublishedBridge = async ({
	route,
	cliVersion,
	env,
	runCommandImpl = runCommand
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	env: NodeJS.ProcessEnv
	runCommandImpl?: RunCommand
}) => {
	const invocation = buildBridgeInvocation({ route, cliVersion })
	const execution = await runCommandImpl({
		...invocation,
		env
	})

	if (execution.exitCode !== 0) {
		throw new BridgeValidationError(
			`Bridge command exited with ${execution.exitCode}`,
			"command",
			execution.exitCode,
			execution.stdout,
			execution.stderr
		)
	}

	const result = parseBridgeJson(execution.stdout)
	if (!result.success || result.status !== "completed") {
		throw new BridgeValidationError(
			`Bridge command finished with status ${result.status}`,
			"result",
			execution.exitCode,
			execution.stdout,
			execution.stderr
		)
	}

	return {
		result,
		execution
	}
}
