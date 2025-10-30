import { treaty } from "@elysiajs/eden"
import type { App } from "@zeko-types-indexer/server"

export type { Indexer } from "@zeko-types-indexer/indexer"

const BASE_URL = "https://indexer.leaderboard.zeko.io"
const STORAGE_KEY = "indexer_api_token"

export function getStoredToken(): string {
	if (typeof window === "undefined") return ""
	try {
		return localStorage.getItem(STORAGE_KEY) ?? ""
	} catch {
		return ""
	}
}

export function setStoredToken(token: string) {
	if (typeof window === "undefined") return
	try {
		localStorage.setItem(STORAGE_KEY, token)
	} catch {}
}

export function clearStoredToken() {
	if (typeof window === "undefined") return
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {}
}

export function getApi() {
	const token = getStoredToken()
	if (token) {
		const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
		return treaty<App>(BASE_URL, { headers })
	}
	return treaty<App>(BASE_URL)
}
