export type FaucetContainerEnv = Env & {
	ZEKO_FAUCET_SENDER_PRIVATE_KEY: string
}

export type ErrorResponse = {
	success: false
	code: string
	message: string
}

export type SuccessResponse = {
	success: true
	hash: string
	amount: typeof import("./constants").CLAIM_AMOUNT
	address: string
	chain: typeof import("./constants").DEFAULT_CHAIN
	explorer_url: string
}

export type ClaimResult = {
	status: number
	payload: SuccessResponse | ErrorResponse
}

export type FaucetRuntimeEnv = Env & {
	CLAIM_MUTEX: DurableObjectNamespace
	FAUCET_BANNED_IPS: KVNamespace
	FAUCET_IP_SPAM: KVNamespace
	SPAM_THRESHOLD: string
	SPAM_WINDOW_SECONDS: string
	BAN_TTL_SECONDS?: string
	RATE_LIMIT_FAUCET: RateLimit
}

export type FaucetContainerResponse =
	| {
			success: true
			hash: string
	  }
	| {
			success: false
			message?: string
	  }

export type GitHubUser = {
	id: number
	login: string
	created_at: string
}

export type ParsedClaimRequest = {
	address: string
	chain: typeof import("./constants").DEFAULT_CHAIN
}

export type TurnstileClaimInput = {
	address: unknown
	chain?: unknown
	clientIp: unknown
}

export type TurnstileClaimRequest = ParsedClaimRequest & {
	clientIp: string
}

export type TurnstileClaimContext = {
	authMethod: "turnstile"
	clientIp: string
}

export type GitHubClaimContext = {
	authMethod: "github"
	githubUser: GitHubUser
}

export type ClaimContext = TurnstileClaimContext | GitHubClaimContext

export type ClaimMutexLease = {
	leaseId: string
	expiresAt: number
}

export type ClaimMutexAcquireResult = { ok: true } | { ok: false; retryAfterMs: number }

export type ClaimMutexStub = {
	acquire(input: { leaseId: string; now: number; ttlMs: number }): Promise<ClaimMutexAcquireResult>
	release(input: { leaseId: string }): Promise<{ ok: true }>
}

export type ClaimMutexHandle = {
	leaseId: string
	resource: string
	stub: ClaimMutexStub
}
