import { beforeEach, describe, expect, it, vi } from "vitest"
import { claimFaucet, fetchGitHubUser } from "../src/api"
import { runClaimCommand } from "../src/commands/claim"
import { runWhoAmICommand } from "../src/commands/whoami"
import { DEFAULT_CHAIN } from "../src/constants"
import { ExitCode } from "../src/errors"

vi.mock("../src/api", () => ({
	claimFaucet: vi.fn(),
	fetchGitHubUser: vi.fn()
}))

const claimFaucetMock = vi.mocked(claimFaucet)
const fetchGitHubUserMock = vi.mocked(fetchGitHubUser)

describe("runClaimCommand", () => {
	beforeEach(() => {
		claimFaucetMock.mockReset()
		delete process.env.GITHUB_TOKEN
	})

	it("rejects extra positional arguments", async () => {
		await expect(
			runClaimCommand({
				addressInput: "B62abc",
				extraPositionals: ["extra"]
			})
		).rejects.toMatchObject({
			code: "invalid_arguments",
			exitCode: ExitCode.General
		})
	})

	it("returns human and json output for a valid claim", async () => {
		process.env.GITHUB_TOKEN = "env-token"
		claimFaucetMock.mockResolvedValueOnce({
			success: true,
			hash: "0xabc",
			amount: "10",
			address: "B62abc",
			chain: DEFAULT_CHAIN,
			explorer_url: "https://zekoscan.io/testnet/tx/0xabc/txInfo?type=zk-tx"
		})

		await expect(
			runClaimCommand({
				addressInput: "  B62abc  "
			})
		).resolves.toEqual({
			human:
				"Claim submitted for B62abc.\nChain: zeko-testnet\nAmount: 10\nTransaction: 0xabc\nExplorer: https://zekoscan.io/testnet/tx/0xabc/txInfo?type=zk-tx",
			json: {
				success: true,
				address: "B62abc",
				chain: DEFAULT_CHAIN,
				amount: "10",
				hash: "0xabc",
				explorer_url: "https://zekoscan.io/testnet/tx/0xabc/txInfo?type=zk-tx"
			}
		})

		expect(claimFaucetMock).toHaveBeenCalledWith("env-token", "B62abc")
	})
})

describe("runWhoAmICommand", () => {
	beforeEach(() => {
		fetchGitHubUserMock.mockReset()
		delete process.env.GITHUB_TOKEN
	})

	it("rejects positional arguments", async () => {
		await expect(
			runWhoAmICommand({
				extraPositionals: ["oops"],
				token: "ghp_token"
			})
		).rejects.toMatchObject({
			code: "invalid_arguments",
			exitCode: ExitCode.General
		})
	})

	it("returns the authenticated GitHub user", async () => {
		fetchGitHubUserMock.mockResolvedValueOnce({
			id: 7,
			login: "zeko",
			name: null,
			html_url: "https://github.com/zeko",
			created_at: "2024-01-01T00:00:00.000Z"
		})

		await expect(
			runWhoAmICommand({
				token: "ghp_flag"
			})
		).resolves.toEqual({
			human:
				"Authenticated as zeko (#7).\nProfile: https://github.com/zeko\nCreated: 2024-01-01T00:00:00.000Z\nToken source: flag",
			json: {
				success: true,
				id: 7,
				login: "zeko",
				name: null,
				html_url: "https://github.com/zeko",
				created_at: "2024-01-01T00:00:00.000Z",
				token_source: "flag"
			}
		})

		expect(fetchGitHubUserMock).toHaveBeenCalledWith("ghp_flag")
	})
})
