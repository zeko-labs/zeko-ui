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

const controlSource = (id: string) => {
	const marker = `data-debug-control="${id}"`
	const start = debugPanelSource.indexOf(marker)
	if (start === -1) return ""
	const end = debugPanelSource.indexOf("</button>", start)
	return debugPanelSource.slice(start, end)
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
			"Sync Backend",
			"Sim Refresh",
			"Clear Completed",
			"Clear Logs",
			"Export"
		]) {
			expect(debugPanelSource).toContain(label)
		}
	})

	it("disables controls that are not currently useful for bug discovery", () => {
		for (const id of [
			"reset",
			"advance",
			"sync-backend",
			"fee-retry",
			"terminal-error",
			"transient-error",
			"cancellable",
			"clear-logs",
			"export"
		]) {
			expect(controlSource(id)).toContain(":disabled")
		}

		for (const id of ["seed-deposit", "seed-withdrawal", "simulate-refresh", "clear-completed"]) {
			expect(controlSource(id)).not.toContain(":disabled")
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

	it("routes debug queue controls through bridge recovery callbacks", () => {
		const store = createBridgeDebugBackendStore({ storage: createMemoryStorage() })
		const syncRecoveredOperations = vi.fn()
		const simulatePageRefresh = vi.fn()
		const clearCompletedOperations = vi.fn()
		const controller = createBridgeDebugPanelController({
			store,
			syncRecoveredOperations,
			simulatePageRefresh,
			clearCompletedOperations
		})

		controller.seedRecoveredOperation("deposit")
		controller.seedRecoveredOperation("withdrawal")
		controller.syncRecoveredOperations()
		controller.simulatePageRefresh()
		controller.clearCompletedOperations()

		expect(syncRecoveredOperations).toHaveBeenCalledTimes(3)
		expect(simulatePageRefresh).toHaveBeenCalledOnce()
		expect(clearCompletedOperations).toHaveBeenCalledOnce()
		expect(store.getSnapshot().seededOperations).toEqual([
			expect.objectContaining({ kind: "deposit" }),
			expect.objectContaining({ kind: "withdrawal" })
		])
	})
})
