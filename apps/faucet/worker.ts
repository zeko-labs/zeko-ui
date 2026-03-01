import { DurableObject, WorkerEntrypoint } from "cloudflare:workers"
import { Container, getRandom } from "@cloudflare/containers"

const INSTANCE_COUNT = 3
const DEFAULT_CHAIN = "zeko-testnet"
const CLAIM_AMOUNT = "10"
const GITHUB_MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000
const GITHUB_CLAIM_WINDOW_SECONDS = 24 * 60 * 60
const DEFAULT_BAN_TTL_SECONDS = 24 * 60 * 60
const MUTEX_LEASE_MS = 30_000
const MUTEX_STORAGE_KEY = "lease"
const MUTEX_ACQUIRE_ATTEMPTS = 3

type FaucetContainerEnv = Env & {
	ZEKO_FAUCET_SENDER_PRIVATE_KEY: string
}

type ErrorResponse = {
	success: false
	code: string
	message: string
}

type SuccessResponse = {
	success: true
	hash: string
	amount: typeof CLAIM_AMOUNT
	address: string
	chain: typeof DEFAULT_CHAIN
	explorer_url: string
}

type ClaimResult = {
	status: number
	payload: SuccessResponse | ErrorResponse
}

type FaucetRuntimeEnv = Env & {
	CLAIM_MUTEX: DurableObjectNamespace<ClaimMutex>
	FAUCET_BANNED_IPS: KVNamespace
	FAUCET_IP_SPAM: KVNamespace
	SPAM_THRESHOLD: string
	SPAM_WINDOW_SECONDS: string
	BAN_TTL_SECONDS?: string
	RATE_LIMIT_FAUCET: RateLimit
}

type FaucetContainerResponse =
	| {
			success: true
			hash: string
	  }
	| {
			success: false
			message?: string
	  }

type GitHubUser = {
	id: number
	login: string
	created_at: string
}

type ParsedClaimRequest = {
	address: string
	chain: typeof DEFAULT_CHAIN
}

type TurnstileClaimInput = {
	address: unknown
	chain?: unknown
	clientIp: unknown
}

type TurnstileClaimRequest = ParsedClaimRequest & {
	clientIp: string
}

type TurnstileClaimContext = {
	authMethod: "turnstile"
	clientIp: string
}

type GitHubClaimContext = {
	authMethod: "github"
	githubUser: GitHubUser
}

type ClaimContext = TurnstileClaimContext | GitHubClaimContext

type ClaimMutexLease = {
	leaseId: string
	expiresAt: number
}

type ClaimMutexAcquireResult = { ok: true } | { ok: false; retryAfterMs: number }

type ClaimMutexHandle = {
	leaseId: string
	resource: string
	stub: ReturnType<FaucetRuntimeEnv["CLAIM_MUTEX"]["get"]>
}

export class Faucet extends Container<FaucetContainerEnv> {
	defaultPort = 3000
	sleepAfter = "5m"
	envVars = {
		ZEKO_FAUCET_SENDER_PRIVATE_KEY: this.env.ZEKO_FAUCET_SENDER_PRIVATE_KEY,
		ZEKO_FAUCET_SEND_AMOUNT: this.env.ZEKO_FAUCET_SEND_AMOUNT
	}

	override onStart() {
		console.log("Container successfully started")
	}

	override onStop() {
		console.log("Container successfully shut down")
	}

	override onError(error: unknown) {
		console.log("Container error:", error)
	}
}

// ClaimMutex instances are short-lived mutexes only. Durable claim policy stays in KV.
export class ClaimMutex extends DurableObject<Env> {
	async acquire({
		leaseId,
		now,
		ttlMs
	}: {
		leaseId: string
		now: number
		ttlMs: number
	}): Promise<ClaimMutexAcquireResult> {
		const existing = await this.ctx.storage.get<ClaimMutexLease>(MUTEX_STORAGE_KEY)
		if (existing && existing.expiresAt > now) {
			return {
				ok: false,
				retryAfterMs: Math.max(1, existing.expiresAt - now)
			}
		}

		await this.ctx.storage.put(MUTEX_STORAGE_KEY, {
			leaseId,
			expiresAt: now + ttlMs
		} satisfies ClaimMutexLease)

		return { ok: true }
	}

	// Releasing requires the matching leaseId so stale callers cannot clear a newer lease.
	async release({ leaseId }: { leaseId: string }) {
		const existing = await this.ctx.storage.get<ClaimMutexLease>(MUTEX_STORAGE_KEY)
		if (existing?.leaseId === leaseId) await this.ctx.storage.delete(MUTEX_STORAGE_KEY)
		return { ok: true }
	}
}

// Turnstile claims are intentionally internal-only and must come through a service binding RPC call.
export class TurnstileClaimsEntrypoint extends WorkerEntrypoint<FaucetRuntimeEnv> {
	async claimWithTurnstile(input: TurnstileClaimInput): Promise<ClaimResult> {
		const parsed = parseTurnstileClaimInput(input)
		if (isClaimResult(parsed)) return parsed

		const blocked = await enforceIpPolicies(parsed.clientIp, this.env)
		if (blocked) return blocked

		return executeClaim({
			body: parsed,
			env: this.env,
			claimContext: {
				authMethod: "turnstile",
				clientIp: parsed.clientIp
			}
		})
	}
}

const jsonError = (status: number, code: string, message: string, headers?: HeadersInit) =>
	Response.json(
		{
			success: false,
			code,
			message
		} satisfies ErrorResponse,
		{
			status,
			headers
		}
	)

const jsonSuccess = (status: number, payload: SuccessResponse) => Response.json(payload, { status })

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

const isAlphaNumeric = (value: string) => /^[a-z0-9]+$/i.test(value)

const isClaimResult = (value: unknown): value is ClaimResult =>
	isRecord(value) && typeof value.status === "number" && isRecord(value.payload)

const toClaimError = (status: number, code: string, message: string): ClaimResult => ({
	status,
	payload: {
		success: false,
		code,
		message
	}
})

const toClaimSuccess = (body: ParsedClaimRequest, hash: string): ClaimResult => ({
	status: 202,
	payload: {
		success: true,
		hash,
		amount: CLAIM_AMOUNT,
		address: body.address,
		chain: body.chain,
		explorer_url: getExplorerUrl(hash)
	}
})

const getAddressClaimKey = ({ chain, address }: ParsedClaimRequest) => `claim:${chain}:${address}`

const getSpamKey = (ip: string) => `spam:${ip}`

const getGitHubClaimKey = (userId: number) => `github:${userId}`

const getExplorerUrl = (hash: string) => `https://zekoscan.io/testnet/tx/${hash}/txInfo?type=zk-tx`

const getBearerToken = (request: Request) => {
	const authorization = request.headers.get("authorization")?.trim()
	if (!authorization) return null
	const [scheme, token] = authorization.split(/\s+/, 2)
	if (scheme?.toLowerCase() !== "bearer" || !token) return null
	return token
}

const getRequestedAuthMethod = (request: Request) =>
	request.headers.get("X-Auth-Method")?.trim().toLowerCase() ?? null

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const parseClaimBody = (body: unknown): ParsedClaimRequest | ClaimResult => {
	if (!isRecord(body))
		return toClaimError(400, "invalid_body", "Request body must be a JSON object.")

	const address = typeof body.address === "string" ? body.address.trim() : ""
	if (!address || !isAlphaNumeric(address))
		return toClaimError(400, "invalid_address", "Address must be a non-empty alphanumeric string.")

	const chain = typeof body.chain === "string" ? body.chain.trim() : DEFAULT_CHAIN
	if (chain !== DEFAULT_CHAIN)
		return toClaimError(400, "invalid_chain", `Only ${DEFAULT_CHAIN} is currently supported.`)

	return {
		address,
		chain: DEFAULT_CHAIN
	}
}

const parseClaimRequest = async (request: Request) => {
	let body: unknown

	try {
		body = await request.json()
	} catch (error) {
		console.error("Failed to parse claim request body:", error)
		return toClaimError(400, "invalid_json", "Request body must be valid JSON.")
	}

	return parseClaimBody(body)
}

const parseTurnstileClaimInput = (
	input: TurnstileClaimInput
): TurnstileClaimRequest | ClaimResult => {
	const parsed = parseClaimBody(input)
	if (isClaimResult(parsed)) return parsed

	const clientIp = typeof input.clientIp === "string" ? input.clientIp.trim() : ""
	if (!clientIp)
		return toClaimError(400, "missing_client_ip", "X-Client-IP is required for turnstile requests.")

	return {
		...parsed,
		clientIp
	}
}

const getSpamState = async (ip: string, env: FaucetRuntimeEnv) => {
	const spamKey = getSpamKey(ip)
	const spamCount = Number.parseInt((await env.FAUCET_IP_SPAM.get(spamKey)) ?? "0", 10) || 0
	const spam = spamCount + 1
	const spamWindow = Number.parseInt(env.SPAM_WINDOW_SECONDS, 10)
	const spamThreshold = Number.parseInt(env.SPAM_THRESHOLD, 10)

	await env.FAUCET_IP_SPAM.put(spamKey, spam.toString(), {
		expirationTtl: spamWindow
	})

	return { spam, spamWindow, spamThreshold }
}

const enforceIpPolicies = async (ip: string, env: FaucetRuntimeEnv) => {
	const banned = await env.FAUCET_BANNED_IPS.get(ip)
	if (banned)
		return toClaimError(
			403,
			"ip_banned",
			"Your IP address has been temporarily blocked due to abuse."
		)

	const { success } = await env.RATE_LIMIT_FAUCET.limit({ key: ip })
	if (!success)
		return toClaimError(
			429,
			"ip_rate_limited",
			"Too many requests from this IP address. Please try again later."
		)

	const { spam, spamThreshold, spamWindow } = await getSpamState(ip, env)
	if (spam > spamThreshold) {
		const banTtl = Number.parseInt(env.BAN_TTL_SECONDS ?? String(DEFAULT_BAN_TTL_SECONDS), 10)
		await env.FAUCET_BANNED_IPS.put(ip, new Date().toISOString(), {
			expirationTtl: banTtl
		})

		console.warn(
			`Auto-banned IP ${ip} for exceeding ${spamThreshold} requests in ${spamWindow} seconds`
		)
		return toClaimError(
			403,
			"ip_banned",
			"Your IP address has been temporarily blocked due to abuse."
		)
	}

	return null
}

const parseGitHubUser = (payload: unknown): GitHubUser | null => {
	if (!isRecord(payload)) return null
	if (typeof payload.id !== "number") return null
	if (typeof payload.login !== "string") return null
	if (typeof payload.created_at !== "string") return null
	return {
		id: payload.id,
		login: payload.login,
		created_at: payload.created_at
	}
}

const isGitHubRateLimited = (response: Response) =>
	response.status === 429 ||
	(response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")

const verifyGitHubUser = async (token: string) => {
	try {
		const response = await fetch("https://api.github.com/user", {
			method: "GET",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"User-Agent": "zeko-faucet-worker"
			}
		})

		if (isGitHubRateLimited(response))
			return toClaimError(
				429,
				"github_rate_limited",
				"GitHub rate limited this token. Try again later."
			)

		if (response.status === 401 || response.status === 403)
			return toClaimError(
				403,
				"github_verification_failed",
				"Failed to verify the provided GitHub token."
			)

		if (!response.ok) {
			console.error("GitHub verification failed with status:", response.status)
			return toClaimError(
				502,
				"github_verification_unavailable",
				"GitHub verification is currently unavailable."
			)
		}

		const user = parseGitHubUser(await response.json())
		if (!user) {
			console.error("GitHub verification returned an unexpected payload")
			return toClaimError(
				502,
				"github_verification_invalid_response",
				"GitHub verification returned an unexpected response."
			)
		}

		const createdAt = Date.parse(user.created_at)
		if (Number.isNaN(createdAt)) {
			console.error("GitHub verification returned an invalid created_at:", user.created_at)
			return toClaimError(
				502,
				"github_verification_invalid_response",
				"GitHub verification returned an invalid response."
			)
		}

		if (Date.now() - createdAt <= GITHUB_MIN_ACCOUNT_AGE_MS)
			return toClaimError(
				403,
				"github_account_too_new",
				"GitHub accounts must be older than 7 days to claim faucet tokens."
			)

		return user
	} catch (error) {
		console.error("GitHub verification request failed:", error)
		return toClaimError(
			502,
			"github_verification_unavailable",
			"GitHub verification is currently unavailable."
		)
	}
}

const parseFaucetContainerResponse = async (
	response: Response
): Promise<FaucetContainerResponse | null> => {
	try {
		const payload = (await response.clone().json()) as unknown
		if (!isRecord(payload) || typeof payload.success !== "boolean") return null

		if (payload.success) {
			if (typeof payload.hash !== "string") return null
			return {
				success: true,
				hash: payload.hash
			}
		}

		return {
			success: false,
			message: typeof payload.message === "string" ? payload.message : undefined
		}
	} catch (error) {
		console.error("Failed to parse faucet container response:", error)
		return null
	}
}

const acquireMutex = async (
	env: FaucetRuntimeEnv,
	resource: string
): Promise<ClaimMutexHandle | null> => {
	const stub = env.CLAIM_MUTEX.get(env.CLAIM_MUTEX.idFromName(resource))

	for (let attempt = 0; attempt < MUTEX_ACQUIRE_ATTEMPTS; attempt += 1) {
		const leaseId = crypto.randomUUID()
		const result = (await stub.acquire({
			leaseId,
			now: Date.now(),
			ttlMs: MUTEX_LEASE_MS
		})) as ClaimMutexAcquireResult

		if (result.ok) {
			return {
				leaseId,
				resource,
				stub
			}
		}

		if (attempt < MUTEX_ACQUIRE_ATTEMPTS - 1) await delay(Math.min(result.retryAfterMs, 25))
	}

	console.warn(`Timed out acquiring mutex for ${resource}`)
	return null
}

const releaseMutexes = async (locks: ClaimMutexHandle[]) => {
	for (const lock of [...locks].reverse()) {
		try {
			await lock.stub.release({ leaseId: lock.leaseId })
		} catch (error) {
			console.error(`Failed to release mutex ${lock.resource}:`, error)
		}
	}
}

const invokeFaucetContainer = async (env: FaucetRuntimeEnv, address: string) => {
	const containerInstance = await getRandom(env.FAUCET, INSTANCE_COUNT)
	const containerResponse = await containerInstance.fetch("https://faucet.internal/", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ address })
	})
	const faucetPayload = await parseFaucetContainerResponse(containerResponse)

	if (!containerResponse.ok) {
		const message =
			faucetPayload?.success === false && faucetPayload.message
				? faucetPayload.message
				: "The faucet service returned an unexpected error."

		if (message.includes("502"))
			return toClaimError(
				503,
				"sequencer_unavailable",
				"The Zeko sequencer is currently unavailable. Please try again later."
			)

		return toClaimError(containerResponse.status, "faucet_request_failed", message)
	}

	if (!faucetPayload || !faucetPayload.success)
		return toClaimError(
			502,
			"invalid_faucet_response",
			"The faucet service returned an unexpected response."
		)

	return faucetPayload
}

// This is the single critical section for claim issuance. All durable claim state remains in KV.
const executeClaim = async ({
	body,
	env,
	claimContext
}: {
	body: ParsedClaimRequest
	env: FaucetRuntimeEnv
	claimContext: ClaimContext
}): Promise<ClaimResult> => {
	const locks: ClaimMutexHandle[] = []
	const addressClaimKey = getAddressClaimKey(body)

	try {
		if (claimContext.authMethod === "github") {
			// GitHub claims always acquire the user mutex first, then the address mutex, to avoid deadlocks.
			const githubLock = await acquireMutex(env, getGitHubClaimKey(claimContext.githubUser.id))
			if (!githubLock)
				return toClaimError(
					503,
					"claim_busy",
					"The faucet service is currently unavailable. Please try again."
				)
			locks.push(githubLock)

			const addressLock = await acquireMutex(env, `address:${body.chain}:${body.address}`)
			if (!addressLock)
				return toClaimError(
					503,
					"claim_busy",
					"The faucet service is currently unavailable. Please try again."
				)
			locks.push(addressLock)

			const githubClaimKey = getGitHubClaimKey(claimContext.githubUser.id)
			const existingGitHubClaim = await env.FAUCET_CLAIM.get(githubClaimKey)
			if (existingGitHubClaim)
				return toClaimError(
					403,
					"github_claim_rate_limited",
					"This GitHub account has already claimed faucet tokens in the last 24 hours."
				)
		} else {
			const addressLock = await acquireMutex(env, `address:${body.chain}:${body.address}`)
			if (!addressLock)
				return toClaimError(
					503,
					"claim_busy",
					"The faucet service is currently unavailable. Please try again."
				)
			locks.push(addressLock)
		}

		const existingAddressClaim = await env.FAUCET_CLAIM.get(addressClaimKey)
		if (existingAddressClaim)
			return toClaimError(
				403,
				"address_already_claimed",
				"This address has already claimed faucet tokens."
			)

		console.log(
			`Claim request received for ${body.address} on ${body.chain} via ${claimContext.authMethod}`
		)

		const containerResult = await invokeFaucetContainer(env, body.address)
		if (isClaimResult(containerResult)) return containerResult

		const claimedAt = new Date().toISOString()
		await env.FAUCET_CLAIM.put(addressClaimKey, claimedAt)

		if (claimContext.authMethod === "github")
			await env.FAUCET_CLAIM.put(getGitHubClaimKey(claimContext.githubUser.id), claimedAt, {
				expirationTtl: GITHUB_CLAIM_WINDOW_SECONDS
			})

		return toClaimSuccess(body, containerResult.hash)
	} catch (error) {
		console.error("Unhandled faucet worker error:", error)
		return toClaimError(500, "internal_error", "An error occurred while processing your request.")
	} finally {
		await releaseMutexes(locks)
	}
}

const claimResultToResponse = ({ status, payload }: ClaimResult) =>
	payload.success ? jsonSuccess(status, payload) : jsonError(status, payload.code, payload.message)

export default {
	async fetch(request, rawEnv, _ctx): Promise<Response> {
		const env = rawEnv as FaucetRuntimeEnv
		const url = new URL(request.url)

		if (url.pathname !== "/claim" && url.pathname !== "/claim/")
			return jsonError(404, "not_found", "Route not found.")

		if (request.method !== "POST")
			return jsonError(405, "method_not_allowed", "Only POST is allowed for this route.", {
				Allow: "POST"
			})

		const body = await parseClaimRequest(request)
		if (isClaimResult(body)) return claimResultToResponse(body)

		const authMethod = getRequestedAuthMethod(request)
		if (authMethod && authMethod !== "github")
			return jsonError(
				400,
				"invalid_auth_method",
				"Public claim requests only accept GitHub bearer authentication."
			)

		const token = getBearerToken(request)
		if (!token)
			return jsonError(
				401,
				"missing_github_token",
				"A GitHub bearer token is required for public claim requests."
			)

		const githubUser = await verifyGitHubUser(token)
		if (isClaimResult(githubUser)) return claimResultToResponse(githubUser)

		return claimResultToResponse(
			await executeClaim({
				body,
				env,
				claimContext: {
					authMethod: "github",
					githubUser
				}
			})
		)
	}
} satisfies ExportedHandler<Env>
