import { defineStore } from "pinia"
import { ref, shallowRef } from "vue"

export const useServiceWorkerUpdateStore = defineStore("serviceWorkerUpdate", () => {
	const updateAvailable = ref(false)
	const isUpdating = ref(false)
	const applyUpdate = shallowRef<(() => void) | null>(null)

	const notifyUpdateAvailable = (handler: () => void) => {
		if (updateAvailable.value) return
		applyUpdate.value = handler
		updateAvailable.value = true
	}

	const update = () => {
		if (!applyUpdate.value || isUpdating.value) return
		isUpdating.value = true
		applyUpdate.value()
	}

	return {
		updateAvailable,
		isUpdating,
		notifyUpdateAvailable,
		update
	}
})
