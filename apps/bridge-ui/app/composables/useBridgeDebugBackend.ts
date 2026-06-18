import { createBridgeDebugPanelController } from "~/debug/bridgeDebugPanel"
import {
	bridgeDebugBackendScenarios,
	getBridgeDebugBackendStore,
	type BridgeDebugBackendScenario,
	type BridgeDebugForcedError,
	type BridgeDebugOperationKind
} from "~~/machines/mockBackend"

export const useBridgeDebugBackend = () => {
	const store = getBridgeDebugBackendStore()
	const controller = createBridgeDebugPanelController({ store })
	const snapshot = ref(store.getSnapshot())

	const refresh = () => {
		snapshot.value = store.getSnapshot()
	}

	onMounted(() => {
		const unsubscribe = store.subscribe((nextSnapshot) => {
			snapshot.value = nextSnapshot
		})
		onBeforeUnmount(unsubscribe)
	})

	return {
		snapshot: readonly(snapshot),
		scenarios: bridgeDebugBackendScenarios,
		advancePendingStatus: () => {
			controller.advancePendingStatus()
			refresh()
		},
		clearLogs: () => {
			controller.clearLogs()
			refresh()
		},
		exportSnapshot: () => controller.exportSnapshot(),
		forceNextError: (error: BridgeDebugForcedError) => {
			controller.forceNextError(error)
			refresh()
		},
		reset: () => {
			controller.reset()
			refresh()
		},
		seedRecoveredOperation: (kind: BridgeDebugOperationKind) => {
			controller.seedRecoveredOperation(kind)
			refresh()
		},
		setScenario: (scenario: BridgeDebugBackendScenario) => {
			controller.setScenario(scenario)
			refresh()
		},
		toggleCancellableDeposit: () => {
			controller.toggleCancellableDeposit()
			refresh()
		}
	}
}
