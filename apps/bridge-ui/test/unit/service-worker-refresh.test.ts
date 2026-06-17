import { describe, expect, it, vi } from "vitest"
import { registerBridgeServiceWorker } from "../../app/service-worker/updateRefresh"

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
	it("asks a waiting replacement worker to activate when the page is already controlled", async () => {
		const waiting = { postMessage: vi.fn() }
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
			reload: vi.fn()
		})

		expect(waiting.postMessage).toHaveBeenCalledWith({ type: "BRIDGE_UI_SKIP_WAITING" })
	})

	it("reloads once when a new service worker takes control", async () => {
		const controllerEvents = createEventTarget()
		const storage = new Map<string, string>()
		const reload = vi.fn()
		const registration = {
			waiting: undefined,
			installing: undefined,
			addEventListener: vi.fn(),
			update: vi.fn()
		}
		const serviceWorker = {
			controller: {},
			register: vi.fn(async () => registration),
			addEventListener: controllerEvents.addEventListener
		}

		await registerBridgeServiceWorker({ serviceWorker, storage, reload })
		controllerEvents.dispatch("controllerchange")
		controllerEvents.dispatch("controllerchange")

		expect(reload).toHaveBeenCalledTimes(1)
		expect(storage.get("bridge-ui-sw-refresh-attempted")).toBe("1")
	})
})
