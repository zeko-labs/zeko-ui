import type {
	BridgeDebugBackendScenario,
	BridgeDebugBackendStore,
	BridgeDebugForcedError,
	BridgeDebugOperationKind
} from "~~/machines/mockBackend"

type BridgeDebugPanelControllerOptions = {
	clearCompletedOperations?: () => void
	simulatePageRefresh?: () => void
	store: BridgeDebugBackendStore
	syncRecoveredOperations?: () => void
}

export const createBridgeDebugPanelController = ({
	clearCompletedOperations,
	simulatePageRefresh,
	syncRecoveredOperations,
	store
}: BridgeDebugPanelControllerOptions) => ({
	advancePendingStatus: () => {
		store.advancePendingStatus()
	},
	clearCompletedOperations: () => {
		clearCompletedOperations?.()
	},
	clearLogs: () => {
		store.clearLogs()
	},
	exportSnapshot: () => store.exportSnapshot(),
	forceNextError: (error: BridgeDebugForcedError) => {
		store.forceNextError(error)
	},
	reset: () => {
		store.reset()
	},
	seedRecoveredOperation: (kind: BridgeDebugOperationKind) => {
		store.seedRecoveredOperation(kind)
		syncRecoveredOperations?.()
	},
	setScenario: (scenario: BridgeDebugBackendScenario) => {
		store.setScenario(scenario)
	},
	simulatePageRefresh: () => {
		simulatePageRefresh?.()
	},
	syncRecoveredOperations: () => {
		syncRecoveredOperations?.()
	},
	toggleCancellableDeposit: () => {
		store.toggleCancellableDeposit()
	}
})
