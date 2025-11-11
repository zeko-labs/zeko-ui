import { treaty } from "@elysiajs/eden"
import type { App } from "@zeko-types-indexer/server"

export type { Indexer } from "@zeko-types-indexer/indexer"

const BASE_URL = import.meta.env.DEV
	? "http://localhost:3000"
	: "https://indexer.leaderboard.zeko.io"

export const STORAGE_KEYS = {
	actions: "indexer_actions_config",
	globalStartingBlock: "indexer_global_starting_block",
	intervalSeconds: "indexer_interval_seconds",
	maxRetries: "indexer_max_retries",
	token: "indexer_api_token"
} as const

export function getStored<T>(key: string, defaultValue: T): T {
	if (typeof window === "undefined") return defaultValue
	try {
		const stored = localStorage.getItem(key)
		return stored ? JSON.parse(stored) : defaultValue
	} catch {
		return defaultValue
	}
}

export function setStored<T>(key: string, value: T) {
	if (typeof window === "undefined") return
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch {}
}

export function clearStoredToken() {
	if (typeof window === "undefined") return
	try {
		localStorage.removeItem(STORAGE_KEYS.token)
	} catch {}
}

export function getApi() {
	const token = getStored(STORAGE_KEYS.token, "")
	if (token) {
		const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
		return treaty<App>(BASE_URL, { headers })
	}
	return treaty<App>(BASE_URL)
}
