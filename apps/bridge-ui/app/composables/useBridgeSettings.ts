import { useLocalStorage } from "@vueuse/core"

export type BridgeTimeoutHours = 0 | 6 | 12 | 24 | 36

const SLOT_DURATION_SECONDS = 180

// When hours is 0, we set it to 1 slot (3 minutes) to avoid zero timeout
const hoursToSlots = (hours: BridgeTimeoutHours): number =>
	hours === 0 ? 1 : (hours * 60 * 60) / SLOT_DURATION_SECONDS

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
