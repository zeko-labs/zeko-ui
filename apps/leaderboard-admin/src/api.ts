import { treaty } from "@elysiajs/eden"
import type { App } from "@zeko/leaderboard"

const app = treaty<App>("localhost:3000")

const BASE_URL = (import.meta as { env: { VITE_INDEXER_URL?: string } }).env.VITE_INDEXER_URL ?? ""

function buildHeaders(token?: string) {
	const headers: Record<string, string> = { "Content-Type": "application/json" }
	if (token) headers["Authorization"] = `Bearer ${token}`
	return headers
}

async function handleResponse(res: Response) {
	const text = await res.text()
	try {
		const json = text ? JSON.parse(text) : null
		if (!res.ok) throw json ?? { message: text }
		return json
	} catch {
		// If JSON parsing failed, rethrow a simple object when non-OK; otherwise return null
		if (!res.ok) throw { message: text }
		return null
	}
}

export async function getStatus(token?: string) {
	const res = await fetch(`${BASE_URL}/status`, { headers: buildHeaders(token) })
	return handleResponse(res)
}

export async function start(token: string | undefined, body: Record<string, unknown>) {
	const res = await fetch(`${BASE_URL}/start`, {
		method: "POST",
		headers: buildHeaders(token),
		body: JSON.stringify(body)
	})
	return handleResponse(res)
}

export async function stop(token?: string) {
	const res = await fetch(`${BASE_URL}/stop`, {
		method: "POST",
		headers: buildHeaders(token)
	})
	return handleResponse(res)
}

export async function broadcast(token?: string) {
	const res = await fetch(`${BASE_URL}/broadcast`, {
		method: "POST",
		headers: buildHeaders(token)
	})
	return handleResponse(res)
}

export async function recalculate(token?: string) {
	const res = await fetch(`${BASE_URL}/recalculate`, {
		method: "POST",
		headers: buildHeaders(token)
	})
	return handleResponse(res)
}

export async function rebuild(token?: string, body?: { fromBlock?: number }) {
	const res = await fetch(`${BASE_URL}/rebuild`, {
		method: "POST",
		headers: buildHeaders(token),
		body: JSON.stringify(body ?? {})
	})
	return handleResponse(res)
}

export default {
	getStatus,
	start,
	stop,
	broadcast,
	recalculate,
	rebuild
}
