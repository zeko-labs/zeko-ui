export const ExitCode = {
	Success: 0,
	General: 1,
	Auth: 2,
	RateLimited: 3,
	InvalidAddress: 4
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

type CliErrorOptions = {
	code: string
	message: string
	exitCode: ExitCodeValue
	details?: unknown
}

export class CliError extends Error {
	override readonly name = "CliError"
	readonly code: string
	readonly exitCode: ExitCodeValue
	readonly details?: unknown

	constructor(options: CliErrorOptions) {
		super(options.message)
		this.code = options.code
		this.exitCode = options.exitCode
		this.details = options.details
	}
}

export const toCliError = (error: unknown) => {
	if (error instanceof CliError) return error

	if (error instanceof Error) {
		return new CliError({
			code: "unexpected_error",
			message: error.message,
			exitCode: ExitCode.General
		})
	}

	return new CliError({
		code: "unexpected_error",
		message: "An unexpected error occurred.",
		exitCode: ExitCode.General,
		details: error
	})
}
