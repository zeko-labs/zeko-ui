export const SERVICE_WORKER_REFRESH_KEY = "bridge-ui-sw-refresh-attempted"
export const SKIP_WAITING_MESSAGE = { type: "BRIDGE_UI_SKIP_WAITING" } as const

type RefreshStorage = {
	get: (key: string) => string | null | undefined
	set: (key: string, value: string) => void
	remove?: (key: string) => void
}

type ServiceWorkerLike = {
	state?: string
	postMessage: (message: unknown) => void
	addEventListener?: (type: "statechange", listener: () => void) => void
}

type ServiceWorkerRegistrationLike = {
	waiting?: ServiceWorkerLike | null
	installing?: ServiceWorkerLike | null
	addEventListener: (type: "updatefound", listener: () => void) => void
	update?: () => Promise<unknown> | unknown
}

type ServiceWorkerContainerLike = {
	controller?: unknown | null
	register: (
		scriptURL: string,
		options?: RegistrationOptions
	) => Promise<ServiceWorkerRegistrationLike>
	addEventListener: (type: "controllerchange", listener: () => void) => void
}

export type ServiceWorkerUpdateHandler = (applyUpdate: () => void) => void

type RegisterBridgeServiceWorkerOptions = {
	serviceWorker: ServiceWorkerContainerLike
	storage: RefreshStorage
	reload: () => void
	onUpdateAvailable?: ServiceWorkerUpdateHandler
	scriptUrl?: string
}

export const sessionRefreshStorage: RefreshStorage = {
	get: (key) => {
		try {
			return sessionStorage.getItem(key)
		} catch {
			return null
		}
	},
	set: (key, value) => {
		try {
			sessionStorage.setItem(key, value)
		} catch {
			return
		}
	},
	remove: (key) => {
		try {
			sessionStorage.removeItem(key)
		} catch {
			return
		}
	}
}

const requestActivation = (
	worker: ServiceWorkerLike | null | undefined,
	hadController: boolean
) => {
	if (worker && hadController) worker.postMessage(SKIP_WAITING_MESSAGE)
}

export const registerBridgeServiceWorker = async ({
	serviceWorker,
	storage,
	reload,
	onUpdateAvailable,
	scriptUrl = "/sw.js"
}: RegisterBridgeServiceWorkerOptions) => {
	const hadController = serviceWorker.controller != null
	let activationRequested = false
	let controllerChanged = false
	let updateAnnounced = false
	let updateWorker: ServiceWorkerLike | null = null
	const reloadOnce = () => {
		if (storage.get(SERVICE_WORKER_REFRESH_KEY) === "1") return
		storage.set(SERVICE_WORKER_REFRESH_KEY, "1")
		reload()
	}
	const announceUpdateAvailable = (worker: ServiceWorkerLike | null | undefined) => {
		if (!worker || !hadController) return
		updateWorker = worker
		if (updateAnnounced) return
		updateAnnounced = true
		onUpdateAvailable?.(() => {
			activationRequested = true
			if (controllerChanged) {
				reloadOnce()
				return
			}
			requestActivation(updateWorker, hadController)
		})
	}
	const trackInstallingWorker = (worker: ServiceWorkerLike | null | undefined) => {
		if (worker?.state === "installed") {
			announceUpdateAvailable(worker)
			return
		}
		worker?.addEventListener?.("statechange", () => {
			if (worker?.state === "installed") {
				announceUpdateAvailable(worker)
			}
		})
	}

	serviceWorker.addEventListener("controllerchange", () => {
		if (!hadController) return
		controllerChanged = true
		if (!activationRequested) return
		reloadOnce()
	})

	const registration = await serviceWorker.register(scriptUrl, { type: "module" })
	announceUpdateAvailable(registration.waiting)
	trackInstallingWorker(registration.installing)

	registration.addEventListener("updatefound", () => {
		trackInstallingWorker(registration.installing)
	})

	try {
		await registration.update?.()
	} catch (error) {
		console.warn("Service worker update check failed", error)
	}

	return registration
}
