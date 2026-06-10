import type { OpsEnv } from "./ops"

type CloudflareContext = {
	env?: OpsEnv
}

type EventContext = {
	_platform?: {
		cloudflare?: CloudflareContext
	}
	cloudflare?: CloudflareContext
}

export const resolveEventEnv = (event: { context: unknown }): OpsEnv => {
	const context = event.context as EventContext
	return (
		context._platform?.cloudflare?.env ??
		context.cloudflare?.env ??
		(globalThis as { __env__?: OpsEnv }).__env__ ??
		process.env
	)
}
