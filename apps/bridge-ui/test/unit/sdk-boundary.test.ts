import bridgePackageJson from "../../package.json?raw"
import bridgeMachineSource from "../../machines/bridge.ts?raw"
import bridgeOperationMachineSource from "../../machines/bridgeOperation.ts?raw"
import nuxtConfigSource from "../../nuxt.config.ts?raw"
import bridgeStoreSource from "../../app/composables/useBridgeStore.ts?raw"
import { describe, expect, it } from "vitest"

describe("SDK ownership boundary", () => {
	it("does not import Lumina SDK for bridge UI wallet behavior", () => {
		const bridgeUiSources = [
			bridgePackageJson,
			nuxtConfigSource,
			bridgeMachineSource,
			bridgeOperationMachineSource,
			bridgeStoreSource
		]

		for (const source of bridgeUiSources) {
			expect(source).not.toContain("@lumina-dex/sdk")
		}
	})
})
