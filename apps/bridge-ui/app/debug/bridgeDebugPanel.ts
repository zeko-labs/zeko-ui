import type {
	BridgeDebugBackendScenario,
	BridgeDebugBackendStore,
	BridgeDebugForcedError,
	BridgeDebugOperationKind
} from "~~/machines/mockBackend"

export const createBridgeDebugPanelController = ({
	store
}: {
	store: BridgeDebugBackendStore
}) => ({
	advancePendingStatus: () => {
		store.advancePendingStatus()
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
	},
	setScenario: (scenario: BridgeDebugBackendScenario) => {
		store.setScenario(scenario)
	},
	toggleCancellableDeposit: () => {
		store.toggleCancellableDeposit()
	}
})
