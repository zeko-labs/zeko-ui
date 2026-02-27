import { defineCommand, runMain } from "citty"
import { runClaimCommand } from "./commands/claim"
import { runWhoAmICommand } from "./commands/whoami"
import { CLI_NAME, CLI_VERSION } from "./constants"
import { toCliError } from "./errors"
import { applyExitCode, markSuccess, printError, printSuccess } from "./output"

const tokenArg = {
	type: "string" as const,
	description: "GitHub token. Falls back to GITHUB_TOKEN."
}

const jsonArg = {
	type: "boolean" as const,
	description: "Emit machine-readable JSON."
}

const getPositionals = (value: unknown) => (Array.isArray(value) ? value : [])

const execute = async ({
	asJson,
	action
}: {
	asJson: boolean
	action: () => Promise<Awaited<ReturnType<typeof runWhoAmICommand>>>
}) => {
	try {
		const result = await action()
		printSuccess(result, asJson)
		markSuccess()
	} catch (error) {
		const cliError = toCliError(error)
		printError(cliError, asJson)
		applyExitCode(cliError.exitCode)
	}
}

const main = defineCommand({
	meta: {
		name: CLI_NAME,
		version: CLI_VERSION,
		description: "CLI for the public Zeko faucet API"
	},
	subCommands: {
		claim: {
			meta: {
				name: "claim",
				description: "Claim faucet tokens for an address"
			},
			args: {
				token: tokenArg,
				json: jsonArg
			},
			async run({ args }) {
				const [addressInput, ...extraPositionals] = getPositionals(args._)

				await execute({
					asJson: Boolean(args.json),
					action: () =>
						runClaimCommand({
							addressInput,
							extraPositionals,
							token: typeof args.token === "string" ? args.token : undefined
						})
				})
			}
		},
		whoami: {
			meta: {
				name: "whoami",
				description: "Verify the current GitHub token and show the associated user"
			},
			args: {
				token: tokenArg,
				json: jsonArg
			},
			async run({ args }) {
				await execute({
					asJson: Boolean(args.json),
					action: () =>
						runWhoAmICommand({
							extraPositionals: getPositionals(args._),
							token: typeof args.token === "string" ? args.token : undefined
						})
				})
			}
		}
	}
})

export const runCli = async () => runMain(main)
