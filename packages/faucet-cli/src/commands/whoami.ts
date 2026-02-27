import { fetchGitHubUser } from "../api"
import { CliError, ExitCode } from "../errors"
import type { CommandOutput } from "../output"
import { resolveToken } from "../validation"

type WhoAmICommandOptions = {
	extraPositionals?: unknown[]
	token?: string
}

export const runWhoAmICommand = async (options: WhoAmICommandOptions): Promise<CommandOutput> => {
	const extras = options.extraPositionals ?? []
	if (extras.length > 0) {
		throw new CliError({
			code: "invalid_arguments",
			message: "whoami does not accept positional arguments.",
			exitCode: ExitCode.General
		})
	}

	const { token, source } = resolveToken(options.token)
	const user = await fetchGitHubUser(token)

	return {
		human: [
			`Authenticated as ${user.login} (#${user.id}).`,
			...(user.name ? [`Name: ${user.name}`] : []),
			`Profile: ${user.html_url}`,
			`Created: ${user.created_at}`,
			`Token source: ${source}`
		].join("\n"),
		json: {
			success: true,
			id: user.id,
			login: user.login,
			name: user.name ?? null,
			html_url: user.html_url,
			created_at: user.created_at,
			token_source: source
		}
	}
}
