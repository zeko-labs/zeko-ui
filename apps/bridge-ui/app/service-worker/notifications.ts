import { QuietError } from "~/errors"

export const dispatch = async ({
	title,
	options
}: { title: string; options: NotificationOptions }) => {
	checkWebpushCompability()
	await askPermission()
	// Get the service worker registration
	const registration = await navigator.serviceWorker.getRegistration()
	if (!registration) {
		console.error("No service worker registration found.")
		return
	}
	await registration.showNotification(title, options)
	console.log("Notification shown successfully.")
}

export const askPermission = async () => {
	if ("Notification" in window) {
		console.log("Asking permission for notification...")
		const permission = await Notification.requestPermission()
		if (permission !== "granted") throw new QuietError("Permission denied")
		console.log("Permission granted for notification.", permission)
		return permission
	}
	//iOS doesn't support Notification API
	const serviceWorker = await navigator.serviceWorker.getRegistration()
	console.log(serviceWorker)
	if (!serviceWorker) throw new QuietError("Service worker not registered")
	const pushManager = serviceWorker.pushManager
	if (!pushManager) {
		throw new QuietError("PushManager is not available in this browser")
	}
	const permissionState = await pushManager.permissionState({ userVisibleOnly: true })
	if (permissionState !== "granted") throw new QuietError("Push notification permission denied")
}

export const checkWebpushCompability = (): void => {
	if (!("serviceWorker" in navigator)) {
		throw new QuietError("Service worker is not supported in this browser.")
	}
	console.log("Webpush is supported in this browser.")
}
