/// <reference types="../worker-configuration.d.ts" />

// Keep this separate augmentation file because nitro-cloudflare-dev only exposes
// `PlatformProxy["env"]`, which defaults to `Record<string, unknown>`. This can go away once the
// adapter exposes an augmentable or generic env type that can be bound to the generated Worker
// `Env` during Nuxt typecheck.
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
