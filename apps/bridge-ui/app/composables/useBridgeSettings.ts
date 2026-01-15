import { useLocalStorage } from "@vueuse/core"

export type BridgeTimeoutHours = 6 | 12 | 24 | 36

const SLOT_DURATION_SECONDS = 180

const hoursToSlots = (hours: BridgeTimeoutHours): number =>
	(hours * 60 * 60) / SLOT_DURATION_SECONDS

export const useBridgeSettings = () => {
	const timeoutHours = useLocalStorage<BridgeTimeoutHours>("bridge-timeout-hours", 24)

	const timeoutSlots = computed(() => hoursToSlots(timeoutHours.value))

	const setTimeoutHours = (hours: BridgeTimeoutHours) => {
		timeoutHours.value = hours
	}

	return {
		timeoutHours: readonly(timeoutHours),
		timeoutSlots,
		setTimeoutHours
	}
}
