import { claimFaucet } from "../api"
import { DEFAULT_CHAIN } from "../constants"
import { CliError, ExitCode } from "../errors"
import type { CommandOutput } from "../output"
import { parseAddress, resolveToken } from "../validation"

type ClaimCommandOptions = {
	addressInput: unknown
	extraPositionals?: unknown[]
	token?: string
}

export const runClaimCommand = async (options: ClaimCommandOptions): Promise<CommandOutput> => {
	const extras = options.extraPositionals ?? []
	if (extras.length > 0) {
		throw new CliError({
			code: "invalid_arguments",
			message: "claim accepts exactly one address argument.",
			exitCode: ExitCode.General
		})
	}

	const address = parseAddress(options.addressInput)
	const { token } = resolveToken(options.token)
	const claim = await claimFaucet(token, address)

	return {
		human: [
			`Claim submitted for ${claim.address}.`,
			`Chain: ${claim.chain}`,
			`Amount: ${claim.amount}`,
			`Transaction: ${claim.hash}`,
			`Explorer: ${claim.explorer_url}`
		].join("\n"),
		json: {
			success: true,
			address: claim.address,
			chain: claim.chain || DEFAULT_CHAIN,
			amount: claim.amount,
			hash: claim.hash,
			explorer_url: claim.explorer_url
		}
	}
}
