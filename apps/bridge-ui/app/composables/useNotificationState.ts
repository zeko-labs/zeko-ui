import { ref, watchEffect } from "vue"

export const useNotificationState = () => {
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

	// Watch for changes or run on component mount
	watchEffect(() => {
		checkPermissions()
	})

	return { serviceWorkerSupported, notificationPermission, isLoading, notificationAPI }
}
