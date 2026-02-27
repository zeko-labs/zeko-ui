import { beforeEach, describe, expect, it, vi } from "vitest"

const getRandomMock = vi.fn()

vi.mock("@cloudflare/containers", () => ({
	Container: class {
		readonly env: unknown

		constructor(_: unknown, env: unknown) {
			this.env = env
		}
	},
	getRandom: getRandomMock
}))

type KvPutCall = [string, string, { expirationTtl?: number }?]

type TestEnv = {
	FAUCET: unknown
	FAUCET_BANNED_IPS: {
		get: ReturnType<typeof vi.fn>
		put: ReturnType<typeof vi.fn>
	}
	FAUCET_IP_SPAM: {
		get: ReturnType<typeof vi.fn>
		put: ReturnType<typeof vi.fn>
	}
	FAUCET_CLAIM: {
		get: ReturnType<typeof vi.fn>
		put: ReturnType<typeof vi.fn>
	}
	SPAM_THRESHOLD: string
	SPAM_WINDOW_SECONDS: string
	BAN_TTL_SECONDS: string
	RATE_LIMIT_FAUCET: {
		limit: ReturnType<typeof vi.fn>
	}
}

const createEnv = (): TestEnv => ({
	FAUCET: {},
	FAUCET_BANNED_IPS: {
		get: vi.fn().mockResolvedValue(null),
		put: vi.fn().mockResolvedValue(undefined)
	},
	FAUCET_IP_SPAM: {
		get: vi.fn().mockResolvedValue(null),
		put: vi.fn().mockResolvedValue(undefined)
	},
	FAUCET_CLAIM: {
		get: vi.fn().mockResolvedValue(null),
		put: vi.fn().mockResolvedValue(undefined)
	},
	SPAM_THRESHOLD: "12",
	SPAM_WINDOW_SECONDS: "3600",
	BAN_TTL_SECONDS: "86400",
	RATE_LIMIT_FAUCET: {
		limit: vi.fn().mockResolvedValue({
			success: true
		})
	}
})

const createContext = () => ({
	waitUntil: vi.fn()
})

const createClaimRequest = ({
	headers,
	body = {
		address: "B62abc",
		chain: "zeko-testnet"
	}
}: {
	headers: HeadersInit
	body?: Record<string, unknown>
}): Request<unknown, IncomingRequestCfProperties<unknown>> =>
	new Request("https://api.faucet.zeko.io/claim", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...headers
		},
		body: JSON.stringify(body)
	}) as Request<unknown, IncomingRequestCfProperties<unknown>>

describe("faucet worker claim safeguards", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.clearAllMocks()
	})

	it("does not consult the removed legacy bare-address claim key", async () => {
		const env = createEnv()
		const ctx = createContext()
		const containerFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					message: "Successfully sent",
					hash: "0xlegacy"
				}),
				{
					status: 200,
					headers: {
						"Content-Type": "application/json"
					}
				}
			)
		)

		env.FAUCET_CLAIM.get.mockImplementation(async (key: string) => {
			if (key === "claim:zeko-testnet:B62abc") return null
			if (key === "B62abc") return "2026-02-26T00:00:00.000Z"
			return null
		})
		getRandomMock.mockResolvedValue({
			fetch: containerFetch
		})

		const { default: worker } = await import("../worker")
		const response = await worker.fetch(
			createClaimRequest({
				headers: {
					"X-Auth-Method": "turnstile",
					"X-Client-IP": "127.0.0.1"
				}
			}),
			env as never,
			ctx as never
		)

		expect(response.status).toBe(202)
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			hash: "0xlegacy"
		})
		expect(env.FAUCET_CLAIM.get).toHaveBeenCalledTimes(1)
		expect(env.FAUCET_CLAIM.get).toHaveBeenCalledWith("claim:zeko-testnet:B62abc")
	})

	it("stores GitHub claim markers in the shared claim namespace", async () => {
		const env = createEnv()
		const ctx = createContext()
		const githubFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: 42,
					login: "zeko",
					created_at: "2024-01-01T00:00:00.000Z"
				}),
				{
					status: 200,
					headers: {
						"Content-Type": "application/json"
					}
				}
			)
		)
		const containerFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					message: "Successfully sent",
					hash: "0xabc"
				}),
				{
					status: 200,
					headers: {
						"Content-Type": "application/json"
					}
				}
			)
		)

		vi.stubGlobal("fetch", githubFetch)
		getRandomMock.mockResolvedValue({
			fetch: containerFetch
		})

		const { default: worker } = await import("../worker")
		const response = await worker.fetch(
			createClaimRequest({
				headers: {
					"X-Auth-Method": "github",
					Authorization: "Bearer ghp_token"
				}
			}),
			env as never,
			ctx as never
		)

		expect(response.status).toBe(202)
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			hash: "0xabc",
			amount: "10"
		})
		expect(githubFetch).toHaveBeenCalledWith("https://api.github.com/user", expect.any(Object))
		expect(containerFetch).toHaveBeenCalledOnce()

		const putCalls = env.FAUCET_CLAIM.put.mock.calls as KvPutCall[]
		expect(putCalls).toHaveLength(2)
		expect(putCalls[0]?.[0]).toBe("claim:zeko-testnet:B62abc")
		expect(putCalls[0]?.[1]).toEqual(expect.any(String))
		expect(putCalls[1]).toEqual([
			"github:42",
			expect.any(String),
			{
				expirationTtl: 86400
			}
		])
		expect(ctx.waitUntil).toHaveBeenCalledOnce()

		vi.unstubAllGlobals()
	})
})
