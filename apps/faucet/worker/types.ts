export type FaucetContainerEnv = {
	ZEKO_FAUCET_SENDER_PRIVATE_KEY: string
	ZEKO_FAUCET_SEND_AMOUNT: string
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

// We would prefer to use Wrangler's generated env type directly, but this worker source is also
// imported transitively by faucet-ui's generated `Service<typeof import("../faucet/worker")>`
// binding types. In the faucet-ui typecheck program, the ambient global `Env` resolves to the UI
// worker bindings, not the faucet worker bindings. We also tried Wrangler's
// `wrangler types --env-interface FaucetEnv`, but Wrangler still emits a global `Cloudflare.Env`
// declaration, so the faucet-ui program still picks up the faucet Durable Object bindings and
// mis-types `env.FAUCET` there. Keep this alias until the faucet worker can consume a generated
// non-global env interface that stays isolated from faucet-ui's `Env`.
export type FaucetWorkerEnv = {
	FAUCET: DurableObjectNamespace<import("./faucet-container").Faucet>
	CLAIM_MUTEX: DurableObjectNamespace<import("./mutex").ClaimMutex>
	FAUCET_CLAIM: KVNamespace
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

export type ClaimMutexHandle = {
	leaseId: string
	resource: string
	stub: ReturnType<FaucetWorkerEnv["CLAIM_MUTEX"]["get"]>
}
