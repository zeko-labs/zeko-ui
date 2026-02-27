import { Container, getRandom } from "@cloudflare/containers"

const INSTANCE_COUNT = 3
const DEFAULT_CHAIN = "zeko-testnet"
const CLAIM_AMOUNT = "10"
const GITHUB_MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000
const GITHUB_CLAIM_WINDOW_SECONDS = 24 * 60 * 60
const DEFAULT_BAN_TTL_SECONDS = 24 * 60 * 60

type AuthMethod = "turnstile" | "github"

type FaucetContainerEnv = Env & {
	ZEKO_FAUCET_SENDER_PRIVATE_KEY: string
}

type FaucetRuntimeEnv = Env & {
	FAUCET_BANNED_IPS: KVNamespace
	FAUCET_IP_SPAM: KVNamespace
	FAUCET_GITHUB_CLAIMS: KVNamespace
	SPAM_THRESHOLD: string
	SPAM_WINDOW_SECONDS: string
	BAN_TTL_SECONDS?: string
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

type ParsedClaimRequest = {
	address: string
	chain: typeof DEFAULT_CHAIN
}

type TurnstileAuthorization = {
	authMethod: "turnstile"
	clientIp: string
}

type GitHubAuthorization = {
	authMethod: "github"
	githubUser: GitHubUser
}

type AuthorizationResult = TurnstileAuthorization | GitHubAuthorization

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

const getAuthMethod = (request: Request): AuthMethod | null => {
	const rawMethod = request.headers.get("X-Auth-Method")?.trim().toLowerCase()
	if (rawMethod === "turnstile" || rawMethod === "github") return rawMethod
	return null
}

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

	const chain = typeof body.chain === "string" ? body.chain.trim() : DEFAULT_CHAIN
	if (chain !== DEFAULT_CHAIN)
		return jsonError(400, "invalid_chain", `Only ${DEFAULT_CHAIN} is currently supported.`)

	return {
		address,
		chain: DEFAULT_CHAIN
	} satisfies ParsedClaimRequest
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
	env
}: {
	request: Request
	env: FaucetRuntimeEnv
}): Promise<AuthorizationResult | Response> => {
	const authMethod = getAuthMethod(request)
	if (!authMethod)
		return jsonError(
			400,
			"invalid_auth_method",
			"X-Auth-Method must be set to either turnstile or github."
		)

	if (authMethod === "turnstile") {
		const clientIp = request.headers.get("X-Client-IP")?.trim()
		if (!clientIp)
			return jsonError(400, "missing_client_ip", "X-Client-IP is required for turnstile requests.")

		const ipBlock = await enforceIpPolicies(clientIp, env)
		if (ipBlock) return ipBlock

		return {
			authMethod,
			clientIp
		}
	}

	const token = getBearerToken(request)
	if (!token)
		return jsonError(
			401,
			"missing_github_token",
			"A GitHub bearer token is required for github auth."
		)

	const githubUser = await verifyGitHubUser(token)
	if (githubUser instanceof Response) return githubUser

	const githubClaimKey = getGitHubClaimKey(githubUser.id)
	const lastClaim = await env.FAUCET_GITHUB_CLAIMS.get(githubClaimKey)
	if (lastClaim)
		return jsonError(
			403,
			"github_claim_rate_limited",
			"This GitHub account has already claimed faucet tokens in the last 24 hours."
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
			return jsonError(405, "method_not_allowed", "Only POST is allowed for this route.", {
				Allow: "POST"
			})

		try {
			const body = await parseClaimRequest(request)
			if (body instanceof Response) return body

			const authorization = await authorizeRequest({ request, env })
			if (authorization instanceof Response) return authorization

			const addressClaimKey = getAddressClaimKey(body)
			const existingAddressClaim = await env.FAUCET_CLAIM.get(addressClaimKey)
			if (existingAddressClaim)
				return jsonError(
					403,
					"address_already_claimed",
					"This address has already claimed faucet tokens."
				)

			console.log(
				`Claim request received for ${body.address} on ${body.chain} via ${authorization.authMethod}`
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

			if (faucetPayload.message !== "Successfully sent" || !faucetPayload.hash)
				return jsonError(
					502,
					"invalid_faucet_response",
					"The faucet service returned an unexpected response."
				)

			const claimedAt = new Date().toISOString()
			const writes: Promise<void>[] = [env.FAUCET_CLAIM.put(addressClaimKey, claimedAt)]

			if (authorization.authMethod === "github")
				writes.push(
					env.FAUCET_GITHUB_CLAIMS.put(getGitHubClaimKey(authorization.githubUser.id), claimedAt, {
						expirationTtl: GITHUB_CLAIM_WINDOW_SECONDS
					})
				)

			ctx.waitUntil(Promise.all(writes))

			return jsonSuccess(202, {
				success: true,
				hash: faucetPayload.hash,
				amount: CLAIM_AMOUNT,
				address: body.address,
				chain: body.chain,
				explorer_url: getExplorerUrl(faucetPayload.hash)
			})
		} catch (error) {
			console.error("Unhandled faucet worker error:", error)
			return jsonError(500, "internal_error", "An error occurred while processing your request.")
		}
	}
} satisfies ExportedHandler<Env>
