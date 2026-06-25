import { getBridgeDebugMode, type BridgeDebugMode } from "./debugMode"
import type { MetricEvent } from "./metrics.schema"

export type { MetricEvent }

const localMetricHostnames = new Set(["localhost", "127.0.0.1", "::1"])
const normalizeHostname = (hostname: string): string =>
	hostname
		.trim()
		.toLowerCase()
		.replace(/^\[(.*)\]$/, "$1")

type UserContext = {
	userAgent: string
	cpuCores: number
	language: string
	screenResolution: string
}

let cachedUserContext: UserContext | null = null

type ShouldSendBridgeMetricInput = {
	debugMode?: BridgeDebugMode
	hostname?: string | null
}

const safeHostname = (): string | null => {
	try {
		return globalThis.location?.hostname ?? null
	} catch {
		return null
	}
}

export const shouldSendBridgeMetric = ({
	debugMode = getBridgeDebugMode(),
	hostname = safeHostname()
}: ShouldSendBridgeMetricInput = {}): boolean =>
	debugMode !== "mock-backend" &&
	(typeof hostname !== "string" || !localMetricHostnames.has(normalizeHostname(hostname)))

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
export const sendMetric = (
	event: MetricEvent,
	walletAddress: string | undefined,
	options: ShouldSendBridgeMetricInput = {}
) => {
	if (!shouldSendBridgeMetric(options)) return

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
