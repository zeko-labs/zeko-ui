import { FetchError, ofetch } from "ofetch"
import * as v from "valibot"
import {
	DEFAULT_CHAIN,
	FAUCET_CLAIM_URL,
	GITHUB_ACCEPT,
	GITHUB_USER_AGENT,
	GITHUB_USER_URL
} from "./constants"
import { CliError, ExitCode } from "./errors"

const FaucetSuccessSchema = v.object({
	success: v.literal(true),
	hash: v.string(),
	amount: v.string(),
	address: v.string(),
	chain: v.string(),
	explorer_url: v.string()
})

const FaucetErrorSchema = v.object({
	success: v.literal(false),
	code: v.string(),
	message: v.string()
})

const GitHubUserSchema = v.object({
	id: v.number(),
	login: v.string(),
	name: v.nullish(v.string()),
	html_url: v.string(),
	created_at: v.string()
})

export type FaucetClaim = v.InferOutput<typeof FaucetSuccessSchema>
export type GitHubUser = v.InferOutput<typeof GitHubUserSchema>

const githubHeaders = (token: string) => ({
	Accept: GITHUB_ACCEPT,
	Authorization: `Bearer ${token}`,
	"User-Agent": GITHUB_USER_AGENT
})

const isGitHubRateLimited = (status: number, headers: Headers) =>
	status === 429 || (status === 403 && headers.get("x-ratelimit-remaining") === "0")

const invalidPayload = (message: string) =>
	new CliError({
		code: "invalid_response",
		message,
		exitCode: ExitCode.General
	})

const requestFailed = (message: string, error: unknown) => {
	if (error instanceof CliError) return error

	const detail =
		error instanceof FetchError
			? error.cause instanceof Error
				? error.cause.message
				: error.message
			: error instanceof Error
				? error.message
				: "Unknown request failure."

	return new CliError({
		code: "request_failed",
		message,
		exitCode: ExitCode.General,
		details: detail
	})
}

export const fetchGitHubUser = async (token: string): Promise<GitHubUser> => {
	try {
		const response = await ofetch.raw(GITHUB_USER_URL, {
			method: "GET",
			headers: githubHeaders(token),
			ignoreResponseError: true
		})

		if (isGitHubRateLimited(response.status, response.headers)) {
			throw new CliError({
				code: "github_rate_limited",
				message: "GitHub rate limited this token. Try again later.",
				exitCode: ExitCode.RateLimited
			})
		}

		if (response.status === 401 || response.status === 403) {
			throw new CliError({
				code: "github_auth_failed",
				message: "Failed to verify the provided GitHub token.",
				exitCode: ExitCode.Auth
			})
		}

		if (!response.ok) {
			throw new CliError({
				code: "github_request_failed",
				message: `GitHub verification failed with status ${response.status}.`,
				exitCode: ExitCode.General
			})
		}

		const result = v.safeParse(GitHubUserSchema, response._data)
		if (!result.success)
			throw invalidPayload("GitHub verification returned an unexpected response.")

		return result.output
	} catch (error) {
		throw requestFailed("GitHub verification is currently unavailable.", error)
	}
}

export const claimFaucet = async (token: string, address: string): Promise<FaucetClaim> => {
	try {
		const response = await ofetch.raw(FAUCET_CLAIM_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"X-Auth-Method": "github"
			},
			body: {
				address,
				chain: DEFAULT_CHAIN
			},
			ignoreResponseError: true
		})

		if (response.ok) {
			const result = v.safeParse(FaucetSuccessSchema, response._data)
			if (!result.success)
				throw invalidPayload("The faucet service returned an unexpected response.")

			return result.output
		}

		const errorResult = v.safeParse(FaucetErrorSchema, response._data)
		const fallbackMessage = `Claim failed with status ${response.status}.`
		const errorCode = errorResult.success ? errorResult.output.code : "claim_failed"
		const message = errorResult.success ? errorResult.output.message : fallbackMessage

		if (response.status === 400 && errorCode === "invalid_address") {
			throw new CliError({
				code: errorCode,
				message,
				exitCode: ExitCode.InvalidAddress
			})
		}

		if (response.status === 429 || errorCode.endsWith("rate_limited")) {
			throw new CliError({
				code: errorCode,
				message,
				exitCode: ExitCode.RateLimited
			})
		}

		if (response.status === 401 || errorCode === "missing_github_token") {
			throw new CliError({
				code: errorCode,
				message,
				exitCode: ExitCode.Auth
			})
		}

		if (
			response.status === 403 &&
			["github_verification_failed", "github_account_too_new", "missing_github_token"].includes(
				errorCode
			)
		) {
			throw new CliError({
				code: errorCode,
				message,
				exitCode: ExitCode.Auth
			})
		}

		throw new CliError({
			code: errorCode,
			message,
			exitCode: ExitCode.General
		})
	} catch (error) {
		throw requestFailed("The faucet service is currently unavailable.", error)
	}
}
