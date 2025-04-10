import type { CfProperties, ExecutionContext, Request } from "@cloudflare/workers-types"

interface Env {
	STORE_FAUCET_URL: string
	FAUCET_URL: string
}

declare module "h3" {
	interface H3EventContext {
		cf: CfProperties
		cloudflare: {
			request: Request
			env: Env
			context: ExecutionContext
		}
	}
}
