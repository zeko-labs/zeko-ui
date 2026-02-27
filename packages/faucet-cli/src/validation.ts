import * as v from "valibot"
import { CliError, ExitCode } from "./errors"

const AddressSchema = v.pipe(
	v.string(),
	v.regex(/^[a-z0-9]+$/i, "Address must be a non-empty alphanumeric string.")
)

export const parseAddress = (value: unknown) => {
	const address = typeof value === "string" ? value.trim() : ""
	const result = v.safeParse(AddressSchema, address)

	if (!result.success) {
		throw new CliError({
			code: "invalid_address",
			message: "Address must be a non-empty alphanumeric string.",
			exitCode: ExitCode.InvalidAddress
		})
	}

	return result.output
}

export const resolveToken = (value?: string | null) => {
	const explicit = value?.trim()
	if (explicit) return { token: explicit, source: "flag" as const }

	const fromEnv = process.env.GITHUB_TOKEN?.trim()
	if (fromEnv) return { token: fromEnv, source: "env" as const }

	throw new CliError({
		code: "missing_token",
		message: "A GitHub token is required. Pass --token or set GITHUB_TOKEN.",
		exitCode: ExitCode.Auth
	})
}
