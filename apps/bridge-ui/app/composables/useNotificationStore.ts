import { askPermission, checkWebpushCompability } from "~/service-worker/notifications"

export const useNotificationStore = defineStore("notifications", () => {
	const serviceWorkerSupported = ref("serviceWorker" in navigator)
	const notificationPermission = ref<"granted" | "denied" | "default">("default")
	const notificationAPI = ref(false)
	const isLoading = ref(true)

	const checkPermissions = async () => {
		isLoading.value = true

		// --- Check for desktop/Android API ---
		if ("Notification" in window) {
			notificationPermission.value = Notification.permission
			isLoading.value = false
			notificationAPI.value = true
			return
		}

		// --- Check for iOS/PWA API ---
		try {
			const serviceWorker = await navigator.serviceWorker.getRegistration()
			if (serviceWorker) {
				const permissionState = await serviceWorker.pushManager.permissionState({
					userVisibleOnly: true
				})
				// Note: permissionState can be 'granted', 'denied', or 'prompt' on some platforms
				if (permissionState === "granted") {
					notificationPermission.value = "granted"
				} else if (permissionState === "denied") {
					notificationPermission.value = "denied"
				} else {
					notificationPermission.value = "default"
				}
			} else {
				// No service worker registered, so no push permission possible
				notificationPermission.value = "denied"
			}
		} catch (error) {
			console.error("Failed to check push notification permission:", error)
			notificationPermission.value = "denied"
		} finally {
			isLoading.value = false
		}
	}

	const toggle = async () => {
		checkWebpushCompability()
		await askPermission()
		checkPermissions()
	}

	onMounted(() => {
		checkPermissions()
		if ("Notification" in window) {
			navigator.permissions.query({ name: "notifications" }).then((permissionStatus) => {
				console.log(`notification permission status is ${permissionStatus.state}`)
				permissionStatus.onchange = () => {
					console.log(`notification permission status has changed to ${permissionStatus.state}`)
					if (permissionStatus.state === "denied") {
						notificationPermission.value = "denied"
					}
					if (permissionStatus.state === "granted") {
						notificationPermission.value = "granted"
					}
					if (permissionStatus.state === "prompt") {
						notificationPermission.value = "default"
					}
				}
			})
		} else {
			;(window as Window).addEventListener("focus", checkPermissions)
		}
	})

	onUnmounted(() => {
		;(window as Window).removeEventListener("focus", checkPermissions)
	})

	return {
		serviceWorkerSupported,
		notificationPermission,
		isLoading,
		notificationAPI,
		toggle
	}
})
