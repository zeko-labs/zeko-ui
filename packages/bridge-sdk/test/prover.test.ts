import { afterEach, describe, expect, it, vi } from "vitest"
import { pollProvingResult } from "../src/prover"
import type { BridgeRuntime } from "../src/runtime"

const buildRuntime = ({ verbose }: { verbose: boolean }): BridgeRuntime =>
	({
		config: {
			verbose,
			pollTimeout: 1,
			l1Url: "http://l1.test",
			l1ArchiveUrl: "http://l1-archive.test",
			zekoUrl: "http://l2.test",
			zekoArchiveUrl: "http://l2-archive.test",
			l1Network: "testnet",
			l2Network: "testnet",
			actionsApi: "http://actions.test"
		},
		l2Client: () => ({
			query: vi.fn().mockResolvedValue({
				data: {
					provingResult: JSON.stringify({ executed: "txn-hash" })
				}
			})
		})
	}) as unknown as BridgeRuntime

afterEach(() => {
	vi.restoreAllMocks()
})

describe("pollProvingResult", () => {
	it("does not write debug logs when the runtime is not verbose", async () => {
		const consoleDebug = vi.spyOn(console, "debug").mockImplementation(() => undefined)

		await expect(pollProvingResult(buildRuntime({ verbose: false }), "proof-key", 0)).resolves.toBe(
			"txn-hash"
		)

		expect(consoleDebug).not.toHaveBeenCalled()
	})
})
