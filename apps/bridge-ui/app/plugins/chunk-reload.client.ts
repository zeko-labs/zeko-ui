const RELOAD_KEY = "chunk-reload-attempted"
const MAX_RELOADS = 1

export default defineNuxtPlugin(() => {
	// Clear the reload counter on successful page load
	const initialCount = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0")
	if (initialCount > 0) {
		sessionStorage.removeItem(RELOAD_KEY)
	}

	window.addEventListener("vite:preloadError", (event) => {
		event.preventDefault()
		const reloadCount = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0")
		if (reloadCount < MAX_RELOADS) {
			sessionStorage.setItem(RELOAD_KEY, String(reloadCount + 1))
			window.location.reload()
		} else {
			console.warn("Chunk load failed after reload attempt. Please refresh manually.")
		}
	})
})
