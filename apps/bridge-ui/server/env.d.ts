/// <reference types="../worker-configuration.d.ts" />
import "@total-typescript/ts-reset"

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
