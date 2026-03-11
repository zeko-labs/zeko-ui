const RELOAD_KEY = "chunk-reload-attempted"
const MAX_RELOADS = 1
const CLEAR_DELAY_MS = 10_000

function safeSessionStorage(action: "get" | "set" | "remove", key: string, value?: string) {
	try {
		if (action === "get") return sessionStorage.getItem(key)
		if (action === "set" && value !== undefined) sessionStorage.setItem(key, value)
		if (action === "remove") sessionStorage.removeItem(key)
	} catch {
		return null
	}
}

export default defineNuxtPlugin(() => {
	// Clear the reload counter only after the page has been stable for a while.
	// Preload errors fire during module loading, well before this timeout.
	setTimeout(() => {
		safeSessionStorage("remove", RELOAD_KEY)
	}, CLEAR_DELAY_MS)

	window.addEventListener("vite:preloadError", (event) => {
		event.preventDefault()
		const reloadCount = Number(safeSessionStorage("get", RELOAD_KEY) ?? "0")
		if (reloadCount < MAX_RELOADS) {
			safeSessionStorage("set", RELOAD_KEY, String(reloadCount + 1))
			window.location.reload()
		} else {
			console.warn("Chunk load failed after reload attempt. Please refresh manually.")
		}
	})
})
