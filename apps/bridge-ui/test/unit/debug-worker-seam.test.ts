import { describe, expect, it, vi } from "vitest"
import type { OperationsWorker } from "../../machines/operations.worker"
import { BRIDGE_DEBUG_MODE_STORAGE_KEY, getBridgeDebugMode } from "../../machines/debugMode"
import { createOperationsWorkerClient } from "../../machines/operationWorkerClient"

const createStorage = (value: string | null): Pick<Storage, "getItem"> => ({
	getItem: vi.fn((key: string) => (key === BRIDGE_DEBUG_MODE_STORAGE_KEY ? value : null))
})

describe("bridge debug worker seam", () => {
	it("uses the local debug-mode override", () => {
		expect(
			getBridgeDebugMode({
				storage: createStorage("mock-backend")
			})
		).toBe("mock-backend")
	})

	it("ignores runtime debug mode when no local override is set", () => {
		expect(
			getBridgeDebugMode({
				storage: createStorage(null)
			})
		).toBe("off")
	})

	it("forces debug mode off on the production bridge host", () => {
		expect(
			getBridgeDebugMode({
				hostname: "bridge.zeko.io",
				storage: createStorage("mock-backend")
			})
		).toBe("off")
	})

	it("allows debug mode on testnet and other hosts", () => {
		expect(
			getBridgeDebugMode({
				hostname: "testnet.bridge.zeko.io",
				storage: createStorage("mock-backend")
			})
		).toBe("mock-backend")
		expect(
			getBridgeDebugMode({
				hostname: "localhost",
				storage: createStorage("mock-backend")
			})
		).toBe("mock-backend")
	})

	it("uses the mock worker factory without constructing the real worker in mock-backend mode", () => {
		const mockWorker = {} as OperationsWorker
		const realWorker = {} as Worker
		const remoteWorker = {} as OperationsWorker
		const createMockWorker = vi.fn(() => mockWorker)
		const createRealWorker = vi.fn(() => realWorker)
		const wrapWorker = vi.fn(() => remoteWorker)

		const client = createOperationsWorkerClient({
			debugMode: "mock-backend",
			createMockWorker,
			createRealWorker,
			wrapWorker
		})

		expect(client.mode).toBe("mock-backend")
		expect(client.worker).toBe(mockWorker)
		expect(createMockWorker).toHaveBeenCalledTimes(1)
		expect(createRealWorker).not.toHaveBeenCalled()
		expect(wrapWorker).not.toHaveBeenCalled()
	})

	it("uses the real Comlink worker by default", () => {
		const realWorker = {} as Worker
		const remoteWorker = {} as OperationsWorker
		const createMockWorker = vi.fn(() => ({}) as OperationsWorker)
		const createRealWorker = vi.fn(() => realWorker)
		const wrapWorker = vi.fn(() => remoteWorker)

		const client = createOperationsWorkerClient({
			debugMode: "off",
			createMockWorker,
			createRealWorker,
			wrapWorker
		})

		expect(client.mode).toBe("off")
		expect(client.worker).toBe(remoteWorker)
		expect(createMockWorker).not.toHaveBeenCalled()
		expect(createRealWorker).toHaveBeenCalledTimes(1)
		expect(wrapWorker).toHaveBeenCalledWith(realWorker)
	})
})
