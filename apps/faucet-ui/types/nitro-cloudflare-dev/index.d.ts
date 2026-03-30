/// <reference path="../../cloudflare-env.d.ts" />
import type { PlatformProxy } from "wrangler"

// Shadow the upstream `nitro-cloudflare-dev` types locally so Nuxt binds
// `event.context.cloudflare.env` to the generated Worker `Env` instead of the upstream default
// `Record<string, unknown>`. This can go away once the adapter exposes a generic or augmentable env
// type and threads it through `nuxi typecheck`.
declare module "h3" {
	interface H3EventContext {
		cf: PlatformProxy<Env>["cf"]
		cloudflare: {
			request: Request & {
				cf: PlatformProxy<Env>["cf"]
			}
			env: PlatformProxy<Env>["env"]
			context: PlatformProxy<Env>["ctx"]
		}
	}
}

declare module "nitropack" {
	interface NitroOptions {
		cloudflareDev?: {
			configPath?: string
			environment?: string
			persistDir?: string
			silent?: boolean
		}
	}
}

declare function nitroCloudflareDev(arg1: unknown, arg2: unknown): void

export default nitroCloudflareDev
