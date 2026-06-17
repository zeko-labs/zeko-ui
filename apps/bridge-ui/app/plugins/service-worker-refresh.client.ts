import {
	registerBridgeServiceWorker,
	SERVICE_WORKER_REFRESH_KEY,
	sessionRefreshStorage
} from "~/service-worker/updateRefresh"

const CLEAR_REFRESH_MARKER_DELAY_MS = 10_000

export default defineNuxtPlugin(() => {
	if (!("serviceWorker" in navigator)) return

	const updateStore = useServiceWorkerUpdateStore()

	setTimeout(() => {
		sessionRefreshStorage.remove?.(SERVICE_WORKER_REFRESH_KEY)
	}, CLEAR_REFRESH_MARKER_DELAY_MS)

	void registerBridgeServiceWorker({
		serviceWorker: navigator.serviceWorker,
		storage: sessionRefreshStorage,
		reload: () => window.location.reload(),
		onUpdateAvailable: updateStore.notifyUpdateAvailable
	}).catch((error: unknown) => {
		console.warn("Unable to register bridge service worker.", error)
	})
})
