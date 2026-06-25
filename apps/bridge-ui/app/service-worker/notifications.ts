import { QuietError } from "~/errors"

type NotificationServiceWorkerRegistration = {
	showNotification: (title: string, options?: NotificationOptions) => Promise<void> | void
	pushManager?: {
		permissionState: (options?: PushSubscriptionOptionsInit) => Promise<PermissionState>
	}
}

type NotificationEnvironment = {
	browserWindow: {
		Notification?: Pick<typeof Notification, "requestPermission">
	}
	navigator: {
		serviceWorker?: {
			getRegistration: () => Promise<NotificationServiceWorkerRegistration | undefined>
		}
	}
}

const defaultNotificationEnvironment = (): NotificationEnvironment => ({
	browserWindow: window,
	navigator
})

const getServiceWorkerRegistration = async ({
	navigator
}: NotificationEnvironment): Promise<NotificationServiceWorkerRegistration | undefined> => {
	if (!navigator.serviceWorker) {
		throw new QuietError("Service worker is not supported in this browser.")
	}
	return navigator.serviceWorker.getRegistration()
}

export const dispatch = async (
	{ title, options }: { title: string; options: NotificationOptions },
	environment = defaultNotificationEnvironment()
) => {
	const registration = await getServiceWorkerRegistration(environment)
	if (!registration) return
	await askPermission(environment, registration)
	await registration.showNotification(title, options)
}

export const askPermission = async (
	environment = defaultNotificationEnvironment(),
	registration?: NotificationServiceWorkerRegistration
) => {
	if (environment.browserWindow.Notification) {
		const permission = await environment.browserWindow.Notification.requestPermission()
		if (permission !== "granted") throw new QuietError("Permission denied")
		return permission
	}
	//iOS doesn't support Notification API
	const serviceWorker = registration ?? (await getServiceWorkerRegistration(environment))
	if (!serviceWorker) throw new QuietError("Service worker not registered")
	const pushManager = serviceWorker.pushManager
	if (!pushManager) {
		throw new QuietError("PushManager is not available in this browser")
	}
	const permissionState = await pushManager.permissionState({ userVisibleOnly: true })
	if (permissionState !== "granted") throw new QuietError("Push notification permission denied")
}

export const checkWebpushCompability = (environment = defaultNotificationEnvironment()): void => {
	if (!environment.navigator.serviceWorker) {
		throw new QuietError("Service worker is not supported in this browser.")
	}
}
