import * as Vue from "vue"
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
		event: Extract<BridgeEvents, { type: "RefreshOperations" } | { type: "SimulatePageRefresh" }>
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
		simulatePageRefresh: () => {
			bridge?.send({ type: "SimulatePageRefresh" })
		},
		syncRecoveredOperations: () => {
			bridge?.send({ type: "RefreshOperations" })
		}
	})
	const snapshot = Vue.ref(store.getSnapshot())

	const refresh = () => {
		snapshot.value = store.getSnapshot()
	}

	if (import.meta.client) {
		const unsubscribe = store.subscribe((nextSnapshot) => {
			snapshot.value = nextSnapshot
		})
		Vue.onScopeDispose(unsubscribe)
	}

	return {
		snapshot: Vue.readonly(snapshot),
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
