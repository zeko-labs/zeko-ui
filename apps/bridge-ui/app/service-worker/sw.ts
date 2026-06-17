/// <reference lib="WebWorker" />
/// <reference types="vite/client" />

type ServiceWorkerBuildManifestEntry = {
	revision: string | null
	url: string
}

declare let self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST?: Array<ServiceWorkerBuildManifestEntry>
}
const sw = self

const SKIP_WAITING_MESSAGE_TYPE = "BRIDGE_UI_SKIP_WAITING"
const BUILD_FINGERPRINT_MESSAGE_TYPE = "BRIDGE_UI_BUILD_FINGERPRINT"
const serviceWorkerBuildFingerprint = (self.__WB_MANIFEST ?? [])
	.map(({ revision, url }) => `${url}:${revision ?? ""}`)
	.join("|")

sw.addEventListener("activate", (event) => {
	event.waitUntil(sw.clients.claim())
})

sw.addEventListener("message", (event) => {
	if (event.data?.type === SKIP_WAITING_MESSAGE_TYPE) {
		event.waitUntil(sw.skipWaiting())
		return
	}
	if (event.data?.type === BUILD_FINGERPRINT_MESSAGE_TYPE) {
		event.source?.postMessage({
			type: BUILD_FINGERPRINT_MESSAGE_TYPE,
			fingerprint: serviceWorkerBuildFingerprint
		})
	}
})

async function isClientFocused() {
	const windowClients = await sw.clients.matchAll({
		type: "window",
		includeUncontrolled: true
	})
	let clientIsFocused = false
	for (const windowClient of windowClients) {
		if (windowClient.focused) {
			clientIsFocused = true
			break
		}
	}
	return clientIsFocused
}

sw.addEventListener("push", (event) => {
	event.waitUntil(
		isClientFocused().then(async (clientIsFocused) => {
			const notificationData = (await event.data?.json()) ?? {}

			if (clientIsFocused) {
				console.log("Client is focused")
				return
			}
			console.log("Notification Data:", notificationData)

			return sw.registration.showNotification("hello", { body: "world" })
		})
	)
})
