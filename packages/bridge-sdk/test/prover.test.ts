import { afterEach, describe, expect, it, vi } from "vitest"
import { pollProvedForest, pollProvingResult } from "../src/prover"
import type { BridgeRuntime } from "../src/runtime"

const buildRuntime = ({
	verbose,
	provingResult = JSON.stringify({ executed: "txn-hash" })
}: {
	verbose: boolean
	provingResult?: string
}): BridgeRuntime =>
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
					provingResult
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

	it("reports invalid proving result JSON with context", async () => {
		await expect(
			pollProvingResult(buildRuntime({ verbose: false, provingResult: "not-json" }), "proof-key", 0)
		).rejects.toThrow("Invalid proving result JSON for key proof-key")
	})

	it("reports unsupported proving result payloads with context", async () => {
		await expect(
			pollProvingResult(
				buildRuntime({ verbose: false, provingResult: JSON.stringify({ status: "unknown" }) }),
				"proof-key",
				0
			)
		).rejects.toThrow("Unsupported proving result payload for key proof-key")
	})
})

describe("pollProvedForest", () => {
	it("returns a proof-only account-update forest without waiting for execution", async () => {
		const proved = [{ body: { publicKey: "vault" }, authorization: { proof: "proof" } }]

		await expect(
			pollProvedForest(
				buildRuntime({
					verbose: false,
					provingResult: JSON.stringify({ proved })
				}),
				"erc20-proof-key",
				0
			)
		).resolves.toEqual(proved)
	})

	it("keeps polling while a proof-only result is pending", async () => {
		const proved = [{ body: { publicKey: "vault" }, authorization: { proof: "proof" } }]
		const query = vi
			.fn()
			.mockResolvedValueOnce({ data: { provingResult: null } })
			.mockResolvedValueOnce({ data: { provingResult: JSON.stringify({ proved }) } })
		const runtime = {
			...buildRuntime({ verbose: false }),
			l2Client: Object.assign(() => ({ query }), { label: "l2" })
		} as BridgeRuntime

		await expect(pollProvedForest(runtime, "pending-key", 0)).resolves.toEqual(proved)
		expect(query).toHaveBeenCalledTimes(2)
	})

	it("surfaces GraphQL polling errors", async () => {
		const runtime = {
			...buildRuntime({ verbose: false }),
			l2Client: Object.assign(
				() => ({ query: vi.fn().mockResolvedValue({ error: new Error("gateway unavailable") }) }),
				{ label: "l2" }
			)
		} as BridgeRuntime

		await expect(pollProvedForest(runtime, "errored-key", 0)).rejects.toThrow("gateway unavailable")
	})

	it("rejects malformed proof-only forests", async () => {
		await expect(
			pollProvedForest(
				buildRuntime({
					verbose: false,
					provingResult: JSON.stringify({ proved: "not-an-array" })
				}),
				"erc20-proof-key",
				0
			)
		).rejects.toThrow("Invalid proved forest for key erc20-proof-key")
	})

	it("does not accept an already-executed native result as a composable forest", async () => {
		await expect(
			pollProvedForest(buildRuntime({ verbose: false }), "erc20-proof-key", 0)
		).rejects.toThrow("Proof key erc20-proof-key was already executed")
	})
})
