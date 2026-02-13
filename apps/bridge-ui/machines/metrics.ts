import type { MetricEvent } from "./metrics.schema"

export type { MetricEvent }

type UserContext = {
	userAgent: string
	cpuCores: number
	language: string
	screenResolution: string
}

let cachedUserContext: UserContext | null = null

/**
 * Collects device context (userAgent, cpuCores, language, screenResolution).
 * Caches the result after first call for performance.
 */
const getUserContext = (walletAddress: string | undefined): Partial<MetricEvent> => {
	if (!cachedUserContext && typeof navigator !== "undefined") {
		cachedUserContext = {
			userAgent: navigator.userAgent,
			cpuCores: navigator.hardwareConcurrency ?? 0,
			language: navigator.language,
			screenResolution: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : ""
		}
	}
	return { ...cachedUserContext, walletAddress }
}

/**
 * Sends a metric event to the /metrics endpoint.
 * Automatically attaches user context and timestamp.
 * Failures are silently ignored (fire-and-forget).
 */
export const sendMetric = (event: MetricEvent, walletAddress: string | undefined) => {
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
