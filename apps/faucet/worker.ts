import { Container, getRandom } from "@cloudflare/containers"

const INSTANCE_COUNT = 3
const ALLOWED_CHAIN = "zeko-testnet"
const GITHUB_MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000
const GITHUB_CLAIM_WINDOW_SECONDS = 24 * 60 * 60
const DEFAULT_BAN_TTL_SECONDS = 24 * 60 * 60

type AuthMethod = "turnstile" | "github"

type ClaimRequestBody = {
	address: string
	chain: string
	cfToken?: string
	githubToken?: string
}

type FaucetContainerEnv = Env & {
	ZEKO_FAUCET_SENDER_PRIVATE_KEY: string
}

type FaucetRuntimeEnv = Env & {
	FAUCET_BANNED_IPS: KVNamespace
	FAUCET_IP_SPAM: KVNamespace
	SPAM_THRESHOLD: string
	SPAM_WINDOW_SECONDS: string
	BAN_TTL_SECONDS?: string
	TURNSTILE_SECRET_KEY?: string
	RATE_LIMIT_FAUCET: RateLimit
}

type FaucetContainerResponse = {
	message?: string
	hash?: string
	data?: unknown
}

type GitHubUser = {
	id: number
	login: string
	created_at: string
}

type ErrorPayload = {
	ok: false
	error: {
		code: string
		message: string
		details?: Record<string, unknown>
	}
}

type SuccessPayload<T> = {
	ok: true
	data: T
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

const jsonError = (
	status: number,
	code: string,
	message: string,
	details?: Record<string, unknown>,
	headers?: HeadersInit
) =>
	new Response(JSON.stringify(buildErrorPayload(code, message, details)), {
		status,
		headers: {
			"Content-Type": "application/json",
			...headers
		}
	})

const jsonSuccess = <T>(status: number, data: T) =>
	Response.json(
		{
			ok: true,
			data
		} satisfies SuccessPayload<T>,
		{ status }
	)

const buildErrorPayload = (
	code: string,
	message: string,
	details?: Record<string, unknown>
): ErrorPayload => ({
	ok: false,
	error: details ? { code, message, details } : { code, message }
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0

const isAlphaNumeric = (value: string) => /^[a-z0-9]+$/i.test(value)

const getClientIp = (request: Request) =>
	request.headers.get("cf-connecting-ip") ||
	request.headers
		.get("x-forwarded-for")
		?.split(",")
		.map((value) => value.trim())
		.find(Boolean) ||
	request.headers.get("x-real-ip") ||
	"unknown"

const getAuthMethod = (request: Request): AuthMethod | null => {
	const rawMethod = request.headers.get("X-Auth-Method")?.trim().toLowerCase()
	if (rawMethod === "turnstile" || rawMethod === "github") return rawMethod
	return null
}

const getAddressClaimKey = ({ chain, address }: Pick<ClaimRequestBody, "chain" | "address">) =>
	`claim:${chain}:${address}`

const getSpamKey = (ip: string) => `spam:${ip}`

const getGitHubClaimKey = (userId: number) => `github:${userId}`

const getBearerToken = (request: Request) => {
	const authorization = request.headers.get("authorization")?.trim()
	if (!authorization) return null
	const [scheme, token] = authorization.split(/\s+/, 2)
	if (scheme?.toLowerCase() !== "bearer" || !token) return null
	return token
}

const parseClaimRequest = async (request: Request) => {
	let body: unknown

	try {
		body = await request.json()
	} catch (error) {
		console.error("Failed to parse claim request body:", error)
		return jsonError(400, "invalid_json", "Request body must be valid JSON.")
	}

	if (!isRecord(body)) return jsonError(400, "invalid_body", "Request body must be a JSON object.")

	const address = typeof body.address === "string" ? body.address.trim() : ""
	if (!address || !isAlphaNumeric(address))
		return jsonError(400, "invalid_address", "Address must be a non-empty alphanumeric string.")

	const chain = typeof body.chain === "string" ? body.chain.trim() : ""
	if (!chain) return jsonError(400, "missing_chain", "Chain is required.")
	if (chain !== ALLOWED_CHAIN)
		return jsonError(400, "unsupported_chain", `Only ${ALLOWED_CHAIN} is currently supported.`)

	const cfToken = isNonEmptyString(body.cfToken) ? body.cfToken.trim() : undefined
	const githubToken = isNonEmptyString(body.githubToken) ? body.githubToken.trim() : undefined

	return {
		address,
		chain,
		cfToken,
		githubToken
	} satisfies ClaimRequestBody
}

const verifyTurnstile = async ({
	token,
	ip,
	secret
}: {
	token: string
	ip: string
	secret: string
}) => {
	try {
		const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ secret, response: token, remoteip: ip })
		})

		const result = (await response.json()) as { success?: boolean }
		if (result.success) return true

		console.error("Turnstile verification failed:", result)
		return false
	} catch (error) {
		console.error("Turnstile verification errored:", error)
		return false
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
		return jsonError(403, "ip_banned", "Your IP address has been temporarily blocked due to abuse.")

	const { success } = await env.RATE_LIMIT_FAUCET.limit({ key: ip })
	if (!success)
		return jsonError(
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
		return jsonError(403, "ip_banned", "Your IP address has been temporarily blocked due to abuse.")
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

		if (response.status === 401 || response.status === 403)
			return jsonError(
				403,
				"github_verification_failed",
				"Failed to verify the provided GitHub token."
			)

		if (!response.ok) {
			console.error("GitHub verification failed with status:", response.status)
			return jsonError(
				502,
				"github_verification_unavailable",
				"GitHub verification is currently unavailable."
			)
		}

		const user = parseGitHubUser(await response.json())
		if (!user) {
			console.error("GitHub verification returned an unexpected payload")
			return jsonError(
				502,
				"github_verification_invalid_response",
				"GitHub verification returned an unexpected response."
			)
		}

		const createdAt = Date.parse(user.created_at)
		if (Number.isNaN(createdAt)) {
			console.error("GitHub verification returned an invalid created_at:", user.created_at)
			return jsonError(
				502,
				"github_verification_invalid_response",
				"GitHub verification returned an invalid response."
			)
		}

		if (Date.now() - createdAt <= GITHUB_MIN_ACCOUNT_AGE_MS)
			return jsonError(
				403,
				"github_account_too_new",
				"GitHub accounts must be older than 7 days to claim faucet tokens."
			)

		return user
	} catch (error) {
		console.error("GitHub verification request failed:", error)
		return jsonError(
			502,
			"github_verification_unavailable",
			"GitHub verification is currently unavailable."
		)
	}
}

const parseFaucetContainerResponse = async (
	response: Response
): Promise<FaucetContainerResponse> => {
	try {
		const payload = (await response.clone().json()) as unknown
		if (!isRecord(payload)) return {}
		return {
			message: typeof payload.message === "string" ? payload.message : undefined,
			hash: typeof payload.hash === "string" ? payload.hash : undefined,
			data: payload.data
		}
	} catch (error) {
		console.error("Failed to parse faucet container response:", error)
		return {}
	}
}

const authorizeRequest = async ({
	request,
	body,
	env,
	ip
}: {
	request: Request
	body: ClaimRequestBody
	env: FaucetRuntimeEnv
	ip: string
}) => {
	const authMethod = getAuthMethod(request)
	if (!authMethod)
		return jsonError(
			400,
			"invalid_auth_method",
			"X-Auth-Method must be set to either turnstile or github."
		)

	if (authMethod === "turnstile") {
		if (!body.cfToken)
			return jsonError(
				400,
				"missing_turnstile_token",
				"A Turnstile token is required for turnstile auth."
			)

		if (!env.TURNSTILE_SECRET_KEY)
			return jsonError(500, "turnstile_not_configured", "Turnstile verification is not configured.")

		const verified = await verifyTurnstile({
			token: body.cfToken,
			ip,
			secret: env.TURNSTILE_SECRET_KEY
		})

		if (!verified)
			return jsonError(
				403,
				"turnstile_verification_failed",
				"Failed to verify you are human. Please try again."
			)

		return { authMethod }
	}

	const token = getBearerToken(request) ?? body.githubToken
	if (!token)
		return jsonError(
			401,
			"missing_github_token",
			"A GitHub personal access token is required for github auth."
		)

	const githubUser = await verifyGitHubUser(token)
	if (githubUser instanceof Response) return githubUser

	const claimKey = getGitHubClaimKey(githubUser.id)
	const lastClaim = await env.FAUCET_CLAIM.get(claimKey)
	if (lastClaim)
		return jsonError(
			403,
			"github_claim_rate_limited",
			"This GitHub account has already claimed faucet tokens in the last 24 hours.",
			{ claimedAt: lastClaim, login: githubUser.login }
		)

	return {
		authMethod,
		githubUser
	}
}

export default {
	async fetch(request, rawEnv, ctx): Promise<Response> {
		const env = rawEnv as FaucetRuntimeEnv
		const url = new URL(request.url)

		if (url.pathname !== "/claim" && url.pathname !== "/claim/")
			return jsonError(404, "not_found", "Route not found.")

		if (request.method !== "POST")
			return jsonError(
				405,
				"method_not_allowed",
				"Only POST is allowed for this route.",
				undefined,
				{ Allow: "POST" }
			)

		try {
			const body = await parseClaimRequest(request)
			if (body instanceof Response) return body

			const ip = getClientIp(request)
			console.log(`Claim request received for ${body.address} on ${body.chain} from ${ip}`)

			const ipBlock = await enforceIpPolicies(ip, env)
			if (ipBlock) return ipBlock

			const authorization = await authorizeRequest({ request, body, env, ip })
			if (authorization instanceof Response) return authorization

			const addressClaimKey = getAddressClaimKey(body)
			const existingAddressClaim = await env.FAUCET_CLAIM.get(addressClaimKey)
			if (existingAddressClaim)
				return jsonError(
					403,
					"address_already_claimed",
					"This address has already claimed faucet tokens.",
					{ claimedAt: existingAddressClaim }
				)

			const containerInstance = await getRandom(env.FAUCET, INSTANCE_COUNT)
			const containerResponse = await containerInstance.fetch("https://faucet.internal/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ address: body.address })
			})
			const faucetPayload = await parseFaucetContainerResponse(containerResponse)

			if (!containerResponse.ok) {
				const message = faucetPayload.message ?? "The faucet service returned an unexpected error."

				if (message.includes("502"))
					return jsonError(
						503,
						"sequencer_unavailable",
						"The Zeko sequencer is currently unavailable. Please try again later."
					)

				return jsonError(containerResponse.status, "faucet_request_failed", message)
			}

			if (faucetPayload.message !== "Successfully sent")
				return jsonError(
					502,
					"invalid_faucet_response",
					"The faucet service returned an unexpected response."
				)

			const claimedAt = new Date().toISOString()
			const writes: Promise<void>[] = [env.FAUCET_CLAIM.put(addressClaimKey, claimedAt)]

			if (authorization.authMethod === "github")
				writes.push(
					env.FAUCET_CLAIM.put(getGitHubClaimKey(authorization.githubUser.id), claimedAt, {
						expirationTtl: GITHUB_CLAIM_WINDOW_SECONDS
					})
				)

			ctx.waitUntil(Promise.all(writes))

			return jsonSuccess(202, {
				message: faucetPayload.message,
				chain: body.chain,
				address: body.address,
				hash: faucetPayload.hash,
				result: faucetPayload.data
			})
		} catch (error) {
			console.error("Unhandled faucet worker error:", error)
			return jsonError(500, "internal_error", "An error occurred while processing your request.")
		}
	}
} satisfies ExportedHandler<Env>
