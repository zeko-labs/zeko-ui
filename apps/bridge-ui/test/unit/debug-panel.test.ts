import debugPanelSource from "../../app/components/BridgeDebugPanel.vue?raw"
import indexSource from "../../app/pages/index.vue?raw"
import { describe, expect, it, vi } from "vitest"
import { createBridgeDebugBackendStore } from "../../machines/mockBackend"
import { createBridgeDebugPanelController } from "../../app/debug/bridgeDebugPanel"

const createMemoryStorage = (): Pick<Storage, "getItem" | "removeItem" | "setItem"> => {
	const values = new Map<string, string>()
	return {
		getItem: (key) => values.get(key) ?? null,
		removeItem: (key) => {
			values.delete(key)
		},
		setItem: (key, value) => {
			values.set(key, value)
		}
	}
}

describe("bridge debug panel", () => {
	it("is rendered from the bridge page only in mock-backend debug mode", () => {
		expect(indexSource).toContain("<BridgeDebugPanel")
		expect(indexSource).toContain('bs.debugMode === "mock-backend"')
	})

	it("includes the expected debug controls", () => {
		for (const label of [
			"Seed Deposit",
			"Seed Withdrawal",
			"RefreshOperations",
			"Sim Refresh",
			"Reset",
			"Export"
		]) {
			expect(debugPanelSource).toContain(label)
		}
		for (const label of [
			"Advance",
			"Fee Retry",
			"Terminal Error",
			"Transient Error",
			"Cancellable",
			"Sync Backend",
			"Clear Logs"
		]) {
			expect(debugPanelSource).not.toContain(label)
		}
	})

	it("mutates scenario state and exports the debug snapshot", () => {
		const store = createBridgeDebugBackendStore({ storage: createMemoryStorage() })
		const controller = createBridgeDebugPanelController({ store })

		controller.setScenario("repro-unindexed-withdrawal-completion")
		controller.seedRecoveredOperation("withdrawal")
		controller.forceNextError("terminal")
		controller.advancePendingStatus()

		const snapshot = JSON.parse(controller.exportSnapshot()) as {
			scenario: string
			forcedError: string
			currentSlot: number
			seededOperations: Array<{ kind: string }>
		}

		expect(snapshot).toMatchObject({
			scenario: "repro-unindexed-withdrawal-completion",
			forcedError: "terminal",
			currentSlot: 2
		})
		expect(snapshot.seededOperations).toEqual([expect.objectContaining({ kind: "withdrawal" })])
	})

	it("routes debug queue controls through bridge recovery callbacks", () => {
		const store = createBridgeDebugBackendStore({ storage: createMemoryStorage() })
		const syncRecoveredOperations = vi.fn()
		const simulatePageRefresh = vi.fn()
		const controller = createBridgeDebugPanelController({
			store,
			syncRecoveredOperations,
			simulatePageRefresh
		})

		controller.seedRecoveredOperation("deposit")
		controller.seedRecoveredOperation("withdrawal")
		controller.syncRecoveredOperations()
		controller.simulatePageRefresh()

		expect(syncRecoveredOperations).toHaveBeenCalledTimes(3)
		expect(simulatePageRefresh).toHaveBeenCalledOnce()
		expect(store.getSnapshot().seededOperations).toEqual([
			expect.objectContaining({ kind: "deposit" }),
			expect.objectContaining({ kind: "withdrawal" })
		])
	})

	it("routes reset through the debug backend store", () => {
		const store = createBridgeDebugBackendStore({ storage: createMemoryStorage() })
		const simulatePageRefresh = vi.fn()
		const controller = createBridgeDebugPanelController({ store, simulatePageRefresh })

		controller.setScenario("repro-claim-failure")
		controller.seedRecoveredOperation("withdrawal")
		controller.reset()

		expect(store.getSnapshot()).toMatchObject({
			scenario: "repro-claim-failure",
			seededOperations: [],
			signatureRequests: [],
			calls: []
		})
		expect(simulatePageRefresh).toHaveBeenCalledOnce()
	})
})
