import { afterEach, describe, expect, it, vi } from "vitest"
import {
	registerBridgeServiceWorker,
	type ServiceWorkerUpdateHandler
} from "../../app/service-worker/updateRefresh"
import serviceWorkerSource from "../../app/service-worker/sw.ts?raw"
import nuxtConfigSource from "../../nuxt.config.ts?raw"

const createEventTarget = () => {
	const listeners = new Map<string, Array<() => void>>()
	return {
		addEventListener: vi.fn((type: string, listener: () => void) => {
			listeners.set(type, [...(listeners.get(type) ?? []), listener])
		}),
		dispatch: (type: string) => {
			for (const listener of listeners.get(type) ?? []) listener()
		}
	}
}

describe("service worker update refresh", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("does not force waiting workers to activate during install", () => {
		expect(serviceWorkerSource).not.toContain('sw.addEventListener("install"')
		expect(serviceWorkerSource).toContain("BRIDGE_UI_SKIP_WAITING")
		expect(serviceWorkerSource).toContain("sw.skipWaiting()")
	})

	it("fingerprints app builds through the injected service worker manifest", () => {
		expect(serviceWorkerSource).toContain("__WB_MANIFEST")
		expect(serviceWorkerSource).toContain("BRIDGE_UI_BUILD_FINGERPRINT")
	})

	it("uses only the custom service worker registration prompt", () => {
		expect(nuxtConfigSource).toContain("client: { registerPlugin: false }")
	})

	it("registers the final worker file emitted by the production PWA build", async () => {
		const registration = {
			waiting: undefined,
			installing: undefined,
			addEventListener: vi.fn(),
			update: vi.fn()
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: vi.fn()
		}

		await registerBridgeServiceWorker({
			serviceWorker,
			storage: new Map(),
			reload: vi.fn()
		})

		expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", { type: "module" })
	})

	it("does not fail registration when the update check fails", async () => {
		const updateError = new Error("network unavailable")
		const registration = {
			waiting: undefined,
			installing: undefined,
			addEventListener: vi.fn(),
			update: vi.fn(async () => {
				throw updateError
			})
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: vi.fn()
		}
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

		await expect(
			registerBridgeServiceWorker({
				serviceWorker,
				storage: new Map(),
				reload: vi.fn()
			})
		).resolves.toBe(registration)
		expect(warn).toHaveBeenCalledWith("Service worker update check failed", updateError)
	})

	it("announces a waiting replacement worker without activating it automatically", async () => {
		const waiting = { postMessage: vi.fn() }
		const onUpdateAvailable = vi.fn<ServiceWorkerUpdateHandler>()
		const registration = {
			waiting,
			installing: undefined,
			addEventListener: vi.fn(),
			update: vi.fn()
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: vi.fn()
		}

		await registerBridgeServiceWorker({
			serviceWorker,
			storage: new Map(),
			reload: vi.fn(),
			onUpdateAvailable
		})

		expect(waiting.postMessage).not.toHaveBeenCalled()
		expect(onUpdateAvailable).toHaveBeenCalledTimes(1)

		onUpdateAvailable.mock.calls[0]?.[0]()

		expect(waiting.postMessage).toHaveBeenCalledWith({ type: "BRIDGE_UI_SKIP_WAITING" })
	})

	it("announces a replacement worker after it finishes installing", async () => {
		const registrationEvents = createEventTarget()
		const installingEvents = createEventTarget()
		const installing = {
			state: "installing",
			postMessage: vi.fn(),
			addEventListener: installingEvents.addEventListener
		}
		const onUpdateAvailable = vi.fn<ServiceWorkerUpdateHandler>()
		const registration = {
			waiting: undefined,
			installing,
			addEventListener: registrationEvents.addEventListener,
			update: vi.fn()
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: vi.fn()
		}

		await registerBridgeServiceWorker({
			serviceWorker,
			storage: new Map(),
			reload: vi.fn(),
			onUpdateAvailable
		})

		registrationEvents.dispatch("updatefound")
		installing.state = "installed"
		installingEvents.dispatch("statechange")

		expect(onUpdateAvailable).toHaveBeenCalledTimes(1)
	})

	it("announces a replacement worker that is already installing after registration", async () => {
		const installingEvents = createEventTarget()
		const installing = {
			state: "installing",
			postMessage: vi.fn(),
			addEventListener: installingEvents.addEventListener
		}
		const onUpdateAvailable = vi.fn<ServiceWorkerUpdateHandler>()
		const registration = {
			waiting: undefined,
			installing,
			addEventListener: vi.fn(),
			update: vi.fn()
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: vi.fn()
		}

		await registerBridgeServiceWorker({
			serviceWorker,
			storage: new Map(),
			reload: vi.fn(),
			onUpdateAvailable
		})

		installing.state = "installed"
		installingEvents.dispatch("statechange")

		expect(onUpdateAvailable).toHaveBeenCalledTimes(1)
	})

	it("reloads once after the user accepts an update and the new worker takes control", async () => {
		const controllerEvents = createEventTarget()
		const storage = new Map<string, string>()
		const reload = vi.fn()
		const waiting = { postMessage: vi.fn() }
		let applyUpdate: (() => void) | undefined
		const registration = {
			waiting,
			installing: undefined,
			addEventListener: vi.fn(),
			update: vi.fn()
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: controllerEvents.addEventListener
		}

		await registerBridgeServiceWorker({
			serviceWorker,
			storage,
			reload,
			onUpdateAvailable: (handler) => {
				applyUpdate = handler
			}
		})

		controllerEvents.dispatch("controllerchange")
		expect(reload).not.toHaveBeenCalled()

		applyUpdate?.()
		controllerEvents.dispatch("controllerchange")
		controllerEvents.dispatch("controllerchange")

		expect(reload).toHaveBeenCalledTimes(1)
		expect(storage.get("bridge-ui-sw-refresh-attempted")).toBe("1")
	})

	it("reloads when the user accepts an update another tab already activated", async () => {
		const controllerEvents = createEventTarget()
		const storage = new Map<string, string>()
		const reload = vi.fn()
		const waiting = { postMessage: vi.fn() }
		let applyUpdate: (() => void) | undefined
		const registration = {
			waiting,
			installing: undefined,
			addEventListener: vi.fn(),
			update: vi.fn()
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: controllerEvents.addEventListener
		}

		await registerBridgeServiceWorker({
			serviceWorker,
			storage,
			reload,
			onUpdateAvailable: (handler) => {
				applyUpdate = handler
			}
		})

		controllerEvents.dispatch("controllerchange")
		expect(reload).not.toHaveBeenCalled()

		applyUpdate?.()

		expect(waiting.postMessage).not.toHaveBeenCalled()
		expect(reload).toHaveBeenCalledTimes(1)
		expect(storage.get("bridge-ui-sw-refresh-attempted")).toBe("1")
	})
})
