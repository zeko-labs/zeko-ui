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

vi.mock("cloudflare:workers", () => ({
	DurableObject: class {
		readonly ctx: unknown
		readonly env: unknown

		constructor(ctx: unknown, env: unknown) {
			this.ctx = ctx
			this.env = env
		}
	},
	WorkerEntrypoint: class {
		readonly ctx: unknown
		readonly env: unknown

		constructor(ctx: unknown, env: unknown) {
			this.ctx = ctx
			this.env = env
		}
	}
}))

type KvPutCall = [string, string, { expirationTtl?: number }?]

type MutexResult = { ok: true } | { ok: false; retryAfterMs: number }

type MutexStub = {
	acquire: ReturnType<typeof vi.fn>
	release: ReturnType<typeof vi.fn>
}

type TestEnv = {
	FAUCET: unknown
	CLAIM_MUTEX: {
		idFromName: ReturnType<typeof vi.fn>
		get: ReturnType<typeof vi.fn>
		stubs: Map<string, MutexStub>
	}
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

const createMutexBinding = () => {
	const stubs = new Map<string, MutexStub>()

	return {
		stubs,
		idFromName: vi.fn((name: string) => name),
		get: vi.fn((id: string) => {
			const existing = stubs.get(id)
			if (existing) return existing

			const created = {
				acquire: vi.fn<() => Promise<MutexResult>>().mockResolvedValue({ ok: true }),
				release: vi.fn<() => Promise<{ ok: true }>>().mockResolvedValue({ ok: true })
			}
			stubs.set(id, created)
			return created
		})
	}
}

const createEnv = (): TestEnv => ({
	FAUCET: {},
	CLAIM_MUTEX: createMutexBinding(),
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

const VALID_ADDRESS = "B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF"

const createContext = () => ({
	waitUntil: vi.fn()
})

const createClaimRequest = ({
	headers,
	body = {
		address: VALID_ADDRESS,
		chain: "zeko-testnet"
	}
}: {
	headers?: HeadersInit
	body?: Record<string, unknown>
} = {}): Request<unknown, IncomingRequestCfProperties<unknown>> =>
	new Request("https://api.faucet.zeko.io/claim", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...headers
		},
		body: JSON.stringify(body)
	}) as Request<unknown, IncomingRequestCfProperties<unknown>>

const createDoState = () => {
	const storage = new Map<string, unknown>()

	return {
		storage: {
			get: vi.fn(async <T>(key: string) => storage.get(key) as T | undefined),
			put: vi.fn(async (key: string, value: unknown) => {
				storage.set(key, value)
			}),
			delete: vi.fn(async (key: string) => {
				storage.delete(key)
			})
		}
	}
}

describe("faucet worker claim safeguards", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.clearAllMocks()
		vi.unstubAllGlobals()
	})

	it("rejects public turnstile requests and keeps that path internal-only", async () => {
		const env = createEnv()
		const ctx = createContext()

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

		expect(response.status).toBe(400)
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			code: "invalid_auth_method"
		})
		expect(env.RATE_LIMIT_FAUCET.limit).not.toHaveBeenCalled()
		expect(env.CLAIM_MUTEX.get).not.toHaveBeenCalled()
	})

	it("rejects addresses that are not valid Mina public keys", async () => {
		const env = createEnv()
		const ctx = createContext()

		const { default: worker } = await import("../worker")
		const response = await worker.fetch(
			createClaimRequest({
				body: {
					address: "abc123",
					chain: "zeko-testnet"
				}
			}),
			env as never,
			ctx as never
		)

		expect(response.status).toBe(400)
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			code: "invalid_address"
		})
		expect(env.RATE_LIMIT_FAUCET.limit).not.toHaveBeenCalled()
		expect(env.CLAIM_MUTEX.get).not.toHaveBeenCalled()
	})

	it("supports turnstile claims through the dedicated RPC entrypoint", async () => {
		const env = createEnv()
		const ctx = createContext()
		const containerFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					success: true,
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
			if (key === `claim:zeko-testnet:${VALID_ADDRESS}`) return null
			if (key === VALID_ADDRESS) return "2026-02-26T00:00:00.000Z"
			return null
		})
		getRandomMock.mockResolvedValue({
			fetch: containerFetch
		})

		const { TurnstileClaimsEntrypoint } = await import("../worker")
		const entrypoint = new TurnstileClaimsEntrypoint(ctx as never, env as never)
		const result = await entrypoint.claimWithTurnstile({
			address: VALID_ADDRESS,
			chain: "zeko-testnet",
			clientIp: "127.0.0.1"
		})

		expect(result.status).toBe(202)
		expect(result.payload).toMatchObject({
			success: true,
			hash: "0xlegacy"
		})
		expect(env.RATE_LIMIT_FAUCET.limit).toHaveBeenCalledWith({ key: "127.0.0.1" })
		expect(env.FAUCET_CLAIM.get).toHaveBeenCalledTimes(1)
		expect(env.FAUCET_CLAIM.get).toHaveBeenCalledWith(`claim:zeko-testnet:${VALID_ADDRESS}`)
	})

	it("maps GitHub API rate limits to the public rate-limited error", async () => {
		const env = createEnv()
		const ctx = createContext()

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response("{}", {
					status: 403,
					headers: {
						"x-ratelimit-remaining": "0"
					}
				})
			)
		)

		const { default: worker } = await import("../worker")
		const response = await worker.fetch(
			createClaimRequest({
				headers: {
					Authorization: "Bearer ghp_token"
				}
			}),
			env as never,
			ctx as never
		)

		expect(response.status).toBe(429)
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			code: "github_rate_limited"
		})
	})

	it("stores GitHub claim markers before responding and does not rely on waitUntil", async () => {
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
					success: true,
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
		expect(putCalls[0]?.[0]).toBe(`claim:zeko-testnet:${VALID_ADDRESS}`)
		expect(putCalls[0]?.[1]).toEqual(expect.any(String))
		expect(putCalls[1]).toEqual([
			"github:42",
			expect.any(String),
			{
				expirationTtl: 86400
			}
		])
		expect(ctx.waitUntil).not.toHaveBeenCalled()
	})

	it("expires mutex leases instead of holding them indefinitely", async () => {
		const { ClaimMutex } = await import("../worker")
		const state = createDoState()
		const mutex = new ClaimMutex(state as never, {} as never)

		await expect(mutex.acquire({ leaseId: "lease-a", now: 10, ttlMs: 1000 })).resolves.toEqual({
			ok: true
		})
		await expect(mutex.acquire({ leaseId: "lease-b", now: 500, ttlMs: 1000 })).resolves.toEqual({
			ok: false,
			retryAfterMs: 510
		})
		await expect(mutex.release({ leaseId: "lease-b" })).resolves.toEqual({ ok: true })
		await expect(mutex.acquire({ leaseId: "lease-c", now: 1011, ttlMs: 1000 })).resolves.toEqual({
			ok: true
		})
	})
})
