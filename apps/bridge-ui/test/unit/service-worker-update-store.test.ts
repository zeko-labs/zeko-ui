import { setActivePinia, createPinia } from "pinia"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useServiceWorkerUpdateStore } from "../../app/composables/useServiceWorkerUpdateStore"

describe("service worker update store", () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it("exposes a clickable update action after a service worker update is available", () => {
		const applyUpdate = vi.fn()
		const store = useServiceWorkerUpdateStore()

		store.notifyUpdateAvailable(applyUpdate)

		expect(store.updateAvailable).toBe(true)
		expect(store.isUpdating).toBe(false)

		store.update()

		expect(store.isUpdating).toBe(true)
		expect(applyUpdate).toHaveBeenCalledTimes(1)
	})
})
