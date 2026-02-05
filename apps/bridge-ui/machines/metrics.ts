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
