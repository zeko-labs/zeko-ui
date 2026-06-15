import { getRandom } from "@cloudflare/containers"
import {
	DEFAULT_BAN_TTL_SECONDS,
	DEFAULT_CHAIN,
	GITHUB_CLAIM_WINDOW_SECONDS,
	GITHUB_MIN_ACCOUNT_AGE_MS,
	INSTANCE_COUNT
} from "./constants"
import { acquireMutex, releaseMutexes } from "./mutex"
import { isClaimResult, isRecord, toClaimError, toClaimSuccess } from "./responses"
import type {
	ClaimContext,
	ClaimMutexHandle,
	ClaimResult,
	FaucetContainerResponse,
	FaucetWorkerEnv,
	GitHubUser,
	ParsedClaimRequest,
	TurnstileClaimInput,
	TurnstileClaimRequest
} from "./types"

export const getAddressClaimKey = ({ chain, address }: ParsedClaimRequest) =>
	`claim:${chain}:${address}`

const getSpamKey = (ip: string) => `spam:${ip}`

export const getGitHubClaimKey = (userId: number) => `github:${userId}`

export const getBearerToken = (request: Request) => {
	const authorization = request.headers.get("authorization")?.trim()
	if (!authorization) return null
	const [scheme, token] = authorization.split(/\s+/, 2)
	if (scheme?.toLowerCase() !== "bearer" || !token) return null
	return token
}

export const getRequestedAuthMethod = (request: Request) =>
	request.headers.get("X-Auth-Method")?.trim().toLowerCase() ?? null

const MINA_ADDRESS_PATTERN = /^B62[1-9A-HJ-NP-Za-km-z]{52}$/

const isMinaAddress = (value: string) => MINA_ADDRESS_PATTERN.test(value)

const parseClaimBody = (body: unknown): ParsedClaimRequest | ClaimResult => {
	if (!isRecord(body))
		return toClaimError(400, "invalid_body", "Request body must be a JSON object.")

	const address = typeof body.address === "string" ? body.address.trim() : ""
	if (!address || !isMinaAddress(address))
		return toClaimError(400, "invalid_address", "Address must be a valid Mina public key.")

	const requestedChain = typeof body.chain === "string" ? body.chain.trim() : DEFAULT_CHAIN
	if (requestedChain !== DEFAULT_CHAIN)
		return toClaimError(400, "invalid_chain", `Only ${DEFAULT_CHAIN} is currently supported.`)

	return {
		address,
		chain: DEFAULT_CHAIN
	}
}

export const parseClaimRequest = async (request: Request) => {
	let body: unknown

	try {
		body = await request.json()
	} catch (error) {
		console.error("Failed to parse claim request body:", error)
		return toClaimError(400, "invalid_json", "Request body must be valid JSON.")
	}

	return parseClaimBody(body)
}

export const parseTurnstileClaimInput = (
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

const getSpamState = async (ip: string, env: FaucetWorkerEnv) => {
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

export const enforceIpPolicies = async (ip: string, env: FaucetWorkerEnv) => {
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

export const verifyGitHubUser = async (token: string) => {
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

const invokeFaucetContainer = async (env: FaucetWorkerEnv, address: string) => {
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
export const executeClaim = async ({
	body,
	env,
	claimContext
}: {
	body: ParsedClaimRequest
	env: FaucetWorkerEnv
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
