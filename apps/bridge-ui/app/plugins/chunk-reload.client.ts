const RELOAD_KEY = "chunk-reload-attempted"
const MAX_RELOADS = 1

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
	const initialCount = Number(safeSessionStorage("get", RELOAD_KEY) ?? "0")
	if (initialCount > 0) {
		safeSessionStorage("remove", RELOAD_KEY)
	}

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
