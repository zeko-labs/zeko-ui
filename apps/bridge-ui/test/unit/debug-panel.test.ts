import debugPanelSource from "../../app/components/BridgeDebugPanel.vue?raw"
import indexSource from "../../app/pages/index.vue?raw"
import { describe, expect, it } from "vitest"
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
			"Reset",
			"Seed Deposit",
			"Seed Withdrawal",
			"Advance",
			"Fee Retry",
			"Terminal Error",
			"Transient Error",
			"Cancellable",
			"Clear Logs",
			"Export"
		]) {
			expect(debugPanelSource).toContain(label)
		}
	})

	it("mutates scenario state and exports the debug snapshot", () => {
		const store = createBridgeDebugBackendStore({ storage: createMemoryStorage() })
		const controller = createBridgeDebugPanelController({ store })

		controller.setScenario("delayed-withdrawal-finalization")
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
			scenario: "delayed-withdrawal-finalization",
			forcedError: "terminal",
			currentSlot: 2
		})
		expect(snapshot.seededOperations).toEqual([expect.objectContaining({ kind: "withdrawal" })])
	})
})
