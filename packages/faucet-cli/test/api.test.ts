import { FetchError, ofetch } from "ofetch"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { claimFaucet, fetchGitHubUser } from "../src/api"
import { DEFAULT_CHAIN } from "../src/constants"
import { CliError, ExitCode } from "../src/errors"

vi.mock("ofetch", () => {
	class MockFetchError extends Error {
		cause?: unknown

		constructor(message: string, options?: { cause?: unknown }) {
			super(message)
			this.name = "FetchError"
			this.cause = options?.cause
		}
	}

	return {
		FetchError: MockFetchError,
		ofetch: {
			raw: vi.fn()
		}
	}
})

type RawResponse = {
	ok: boolean
	status: number
	headers: Headers
	_data: unknown
}

const rawMock = vi.mocked(ofetch.raw)

const createResponse = ({
	ok,
	status,
	data,
	headers = new Headers()
}: {
	ok: boolean
	status: number
	data: unknown
	headers?: Headers
}): RawResponse => ({
	ok,
	status,
	headers,
	_data: data
})

describe("fetchGitHubUser", () => {
	beforeEach(() => {
		rawMock.mockReset()
	})

	it("returns the parsed GitHub user payload", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: true,
				status: 200,
				data: {
					id: 7,
					login: "zeko",
					name: "Zeko",
					html_url: "https://github.com/zeko",
					created_at: "2024-01-01T00:00:00.000Z"
				}
			})
		)

		await expect(fetchGitHubUser("ghp_token")).resolves.toEqual({
			id: 7,
			login: "zeko",
			name: "Zeko",
			html_url: "https://github.com/zeko",
			created_at: "2024-01-01T00:00:00.000Z"
		})

		expect(rawMock).toHaveBeenCalledWith("https://api.github.com/user", {
			method: "GET",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: "Bearer ghp_token",
				"User-Agent": "zeko-faucet-cli"
			},
			ignoreResponseError: true
		})
	})

	it("maps GitHub rate limits to the rate-limited exit code", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 403,
				headers: new Headers({
					"x-ratelimit-remaining": "0"
				}),
				data: {}
			})
		)

		await expect(fetchGitHubUser("ghp_token")).rejects.toMatchObject({
			code: "github_rate_limited",
			exitCode: ExitCode.RateLimited
		})
	})

	it("maps auth failures to the auth exit code", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 401,
				data: {}
			})
		)

		await expect(fetchGitHubUser("ghp_token")).rejects.toMatchObject({
			code: "github_auth_failed",
			exitCode: ExitCode.Auth
		})
	})

	it("throws a general error for unexpected GitHub failures", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 500,
				data: {}
			})
		)

		await expect(fetchGitHubUser("ghp_token")).rejects.toMatchObject({
			code: "github_request_failed",
			exitCode: ExitCode.General
		})
	})

	it("rejects invalid GitHub payloads", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: true,
				status: 200,
				data: {
					id: "7"
				}
			})
		)

		await expect(fetchGitHubUser("ghp_token")).rejects.toMatchObject({
			code: "invalid_response",
			exitCode: ExitCode.General
		})
	})

	it("wraps fetch errors with the original cause details", async () => {
		rawMock.mockRejectedValueOnce(new FetchError("request failed", { cause: new Error("socket") }))

		await expect(fetchGitHubUser("ghp_token")).rejects.toMatchObject({
			code: "request_failed",
			exitCode: ExitCode.General,
			details: "socket"
		})
	})
})

describe("claimFaucet", () => {
	beforeEach(() => {
		rawMock.mockReset()
	})

	it("accepts successful faucet responses with a string amount", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: true,
				status: 202,
				data: {
					success: true,
					hash: "0xabc",
					amount: "10",
					address: "B62abc",
					chain: DEFAULT_CHAIN,
					explorer_url: "https://zekoscan.io/testnet/tx/0xabc/txInfo?type=zk-tx"
				}
			})
		)

		await expect(claimFaucet("ghp_token", "B62abc")).resolves.toEqual({
			success: true,
			hash: "0xabc",
			amount: "10",
			address: "B62abc",
			chain: DEFAULT_CHAIN,
			explorer_url: "https://zekoscan.io/testnet/tx/0xabc/txInfo?type=zk-tx"
		})

		expect(rawMock).toHaveBeenCalledWith("https://api.faucet.zeko.io/claim", {
			method: "POST",
			headers: {
				Authorization: "Bearer ghp_token",
				"Content-Type": "application/json",
				"X-Auth-Method": "github"
			},
			body: {
				address: "B62abc",
				chain: DEFAULT_CHAIN
			},
			ignoreResponseError: true
		})
	})

	it("rejects invalid success payloads", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: true,
				status: 202,
				data: {
					success: true
				}
			})
		)

		await expect(claimFaucet("ghp_token", "B62abc")).rejects.toMatchObject({
			code: "invalid_response",
			exitCode: ExitCode.General
		})
	})

	it("maps invalid addresses to the invalid-address exit code", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 400,
				data: {
					success: false,
					code: "invalid_address",
					message: "bad"
				}
			})
		)

		await expect(claimFaucet("ghp_token", "bad")).rejects.toMatchObject({
			code: "invalid_address",
			exitCode: ExitCode.InvalidAddress
		})
	})

	it("maps claim rate limits to the rate-limited exit code", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 403,
				data: {
					success: false,
					code: "github_claim_rate_limited",
					message: "slow down"
				}
			})
		)

		await expect(claimFaucet("ghp_token", "B62abc")).rejects.toMatchObject({
			code: "github_claim_rate_limited",
			exitCode: ExitCode.RateLimited
		})
	})

	it("maps missing GitHub tokens to the auth exit code", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 401,
				data: {
					success: false,
					code: "missing_github_token",
					message: "token required"
				}
			})
		)

		await expect(claimFaucet("ghp_token", "B62abc")).rejects.toMatchObject({
			code: "missing_github_token",
			exitCode: ExitCode.Auth
		})
	})

	it("maps GitHub verification failures to the auth exit code", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 403,
				data: {
					success: false,
					code: "github_verification_failed",
					message: "nope"
				}
			})
		)

		await expect(claimFaucet("ghp_token", "B62abc")).rejects.toMatchObject({
			code: "github_verification_failed",
			exitCode: ExitCode.Auth
		})
	})

	it("falls back to a general claim error when the payload is not parseable", async () => {
		rawMock.mockResolvedValueOnce(
			createResponse({
				ok: false,
				status: 500,
				data: {
					oops: true
				}
			})
		)

		await expect(claimFaucet("ghp_token", "B62abc")).rejects.toMatchObject({
			code: "claim_failed",
			exitCode: ExitCode.General
		})
	})

	it("wraps non-Error failures with a default message", async () => {
		rawMock.mockRejectedValueOnce("offline")
		const claim = claimFaucet("ghp_token", "B62abc")

		await expect(claim).rejects.toBeInstanceOf(CliError)
		await expect(claim).rejects.toMatchObject({
			code: "request_failed",
			exitCode: ExitCode.General,
			details: "Unknown request failure."
		})
	})
})
