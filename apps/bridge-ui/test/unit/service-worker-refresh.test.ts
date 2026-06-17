import { describe, expect, it, vi } from "vitest"
import {
	registerBridgeServiceWorker,
	type ServiceWorkerUpdateHandler
} from "../../app/service-worker/updateRefresh"
import serviceWorkerSource from "../../app/service-worker/sw.ts?raw"

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
	it("does not force waiting workers to activate during install", () => {
		expect(serviceWorkerSource).not.toContain('sw.addEventListener("install"')
		expect(serviceWorkerSource).toContain("BRIDGE_UI_SKIP_WAITING")
		expect(serviceWorkerSource).toContain("sw.skipWaiting()")
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
})
