import { type CliError, ExitCode } from "./errors"

export type CommandOutput = {
	human: string
	json: Record<string, unknown>
}

const stringify = (payload: Record<string, unknown>) => JSON.stringify(payload, null, 2)

export const printSuccess = (output: CommandOutput, asJson: boolean) => {
	if (asJson) {
		console.log(stringify(output.json))
		return
	}

	console.log(output.human)
}

export const printError = (error: CliError, asJson: boolean) => {
	const payload = {
		success: false,
		code: error.code,
		message: error.message,
		...(error.details === undefined ? {} : { details: error.details })
	}

	if (asJson) {
		console.log(stringify(payload))
		return
	}

	console.error(`Error: ${error.message}`)
}

export const applyExitCode = (value: number) => {
	process.exitCode = value
	return value
}

export const markSuccess = () => applyExitCode(ExitCode.Success)
