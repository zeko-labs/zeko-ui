import type { MetricEvent } from "./metrics.schema"

export type { MetricEvent }

type UserContext = {
	userAgent: string
	cpuCores: number
	language: string
	screenResolution: string
}

let cachedUserContext: UserContext | null = null
let cachedWalletAddress: string | undefined

export const clearWalletAddress = () => {
	cachedWalletAddress = undefined
}

/**
 * Collects device context (userAgent, cpuCores, language, screenResolution).
 * Caches the result after first call for performance.
 */
const getUserContext = (walletAddress?: string): Partial<MetricEvent> => {
	if (!cachedUserContext) {
		cachedUserContext = {
			userAgent: navigator.userAgent,
			cpuCores: navigator.hardwareConcurrency ?? 0,
			language: navigator.language,
			screenResolution: `${screen.width}x${screen.height}`
		}
	}
	if (walletAddress !== undefined) cachedWalletAddress = walletAddress
	return { ...cachedUserContext, walletAddress: cachedWalletAddress }
}

/**
 * Sends a metric event to the /metrics endpoint.
 * Automatically attaches user context and timestamp.
 * Failures are silently ignored (fire-and-forget).
 */
export const sendMetric = (event: MetricEvent, walletAddress?: string) => {
	const payload: MetricEvent = {
		...getUserContext(walletAddress),
		...event,
		timestamp: event.timestamp ?? Date.now()
	}
	fetch("/metrics", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		keepalive: true
	}).catch(() => {})
}
