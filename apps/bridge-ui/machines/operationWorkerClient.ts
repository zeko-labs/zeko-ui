import * as Sentry from "@sentry/nuxt"
import * as Comlink from "comlink"
import type { BridgeDebugMode } from "./debugMode"
import { createMockBridgeOperationsWorker } from "./mockBackend"
import type { OperationsWorker } from "./operations.worker"
import workerUrl from "./operations.worker?worker&url"

export type OperationWorker = OperationsWorker | Comlink.Remote<OperationsWorker>

export type OperationsWorkerClient = {
	mode: BridgeDebugMode
	worker: OperationWorker
}

type CreateOperationsWorkerClientOptions = {
	debugMode?: BridgeDebugMode
	createMockWorker?: () => OperationsWorker
	createRealWorker?: () => Worker
	wrapWorker?: (worker: Worker) => OperationWorker
	addSentryIntegration?: (worker: Worker) => void
}

const createRealWorker = () => new Worker(new URL(workerUrl, import.meta.url), { type: "module" })

const createMockWorker = (): OperationsWorker => createMockBridgeOperationsWorker()

const wrapWorker = (worker: Worker): OperationWorker => Comlink.wrap<OperationsWorker>(worker)

const addSentryIntegration = (worker: Worker) => {
	if (import.meta.client) {
		Sentry.addIntegration(Sentry.webWorkerIntegration({ worker }))
	}
}

export const createOperationsWorkerClient = ({
	debugMode = "off",
	createMockWorker: createMock = createMockWorker,
	createRealWorker: createReal = createRealWorker,
	wrapWorker: wrap = wrapWorker,
	addSentryIntegration: addSentry = addSentryIntegration
}: CreateOperationsWorkerClientOptions = {}): OperationsWorkerClient => {
	if (debugMode === "mock-backend") {
		return {
			mode: debugMode,
			worker: createMock()
		}
	}

	const realWorker = createReal()
	addSentry(realWorker)
	return {
		mode: "off",
		worker: wrap(realWorker)
	}
}
