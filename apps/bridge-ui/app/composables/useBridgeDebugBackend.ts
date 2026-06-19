import { createBridgeDebugPanelController } from "~/debug/bridgeDebugPanel"
import {
	bridgeDebugBackendScenarios,
	getBridgeDebugBackendStore,
	type BridgeDebugBackendScenario,
	type BridgeDebugForcedError,
	type BridgeDebugOperationKind
} from "~~/machines/mockBackend"
import type { BridgeEvents } from "~~/machines/bridge"

type BridgeDebugPanelBridge = {
	send: (
		event: Extract<
			BridgeEvents,
			| { type: "ClearCompletedOperations" }
			| { type: "RefreshOperations" }
			| { type: "SimulatePageRefresh" }
		>
	) => void
}

export const useBridgeDebugBackend = ({
	bridge
}: {
	bridge?: BridgeDebugPanelBridge
} = {}) => {
	const store = getBridgeDebugBackendStore()
	const controller = createBridgeDebugPanelController({
		store,
		clearCompletedOperations: () => {
			bridge?.send({ type: "ClearCompletedOperations" })
		},
		simulatePageRefresh: () => {
			bridge?.send({ type: "SimulatePageRefresh" })
		},
		syncRecoveredOperations: () => {
			bridge?.send({ type: "RefreshOperations" })
		}
	})
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
		clearCompletedOperations: () => {
			controller.clearCompletedOperations()
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
		simulatePageRefresh: () => {
			controller.simulatePageRefresh()
			refresh()
		},
		syncRecoveredOperations: () => {
			controller.syncRecoveredOperations()
			refresh()
		},
		toggleCancellableDeposit: () => {
			controller.toggleCancellableDeposit()
			refresh()
		}
	}
}
