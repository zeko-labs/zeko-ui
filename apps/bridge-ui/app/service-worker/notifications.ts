import { QuietError } from "~/errors"
import { getBridgeDebugMode, type BridgeDebugMode } from "~~/machines/debugMode"

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
	debugMode?: BridgeDebugMode
	hostname?: string | null
	navigator: {
		serviceWorker?: {
			getRegistration: () => Promise<NotificationServiceWorkerRegistration | undefined>
		}
	}
}

const localNotificationHostnames = new Set(["localhost", "127.0.0.1", "::1"])
const normalizeHostname = (hostname: string): string =>
	hostname
		.trim()
		.toLowerCase()
		.replace(/^\[(.*)\]$/, "$1")

const safeHostname = (): string | null => {
	try {
		return globalThis.location?.hostname ?? null
	} catch {
		return null
	}
}

const defaultNotificationEnvironment = (): NotificationEnvironment => ({
	browserWindow: window,
	debugMode: getBridgeDebugMode(),
	hostname: safeHostname(),
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

const shouldIgnoreMissingServiceWorkerRegistration = ({
	debugMode = getBridgeDebugMode(),
	hostname = safeHostname()
}: NotificationEnvironment): boolean => {
	if (debugMode === "mock-backend") return true
	return typeof hostname === "string" && localNotificationHostnames.has(normalizeHostname(hostname))
}

export const dispatch = async (
	{ title, options }: { title: string; options: NotificationOptions },
	environment = defaultNotificationEnvironment()
) => {
	const registration = await getServiceWorkerRegistration(environment)
	if (!registration) {
		if (shouldIgnoreMissingServiceWorkerRegistration(environment)) return
		throw new Error("No service worker registration found.")
	}
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
