/// <reference types="./worker-configuration.d.ts" />
/// <reference types="vite-plugin-comlink/client" />

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

export {}
