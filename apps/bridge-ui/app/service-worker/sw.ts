/// <reference lib="WebWorker" />
/// <reference types="vite/client" />

declare let self: ServiceWorkerGlobalScope
const sw = self

const SKIP_WAITING_MESSAGE_TYPE = "BRIDGE_UI_SKIP_WAITING"

sw.addEventListener("install", (event) => {
	event.waitUntil(sw.skipWaiting())
})

sw.addEventListener("activate", (event) => {
	event.waitUntil(sw.clients.claim())
})

sw.addEventListener("message", (event) => {
	if (event.data?.type === SKIP_WAITING_MESSAGE_TYPE) {
		event.waitUntil(sw.skipWaiting())
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
