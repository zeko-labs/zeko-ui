import { afterEach, describe, expect, it, vi } from "vitest"
import { BRIDGE_DEBUG_MODE_STORAGE_KEY } from "../../machines/debugMode"
import { sendMetric, shouldSendBridgeMetric } from "../../machines/metrics"

describe("bridge metrics", () => {
	afterEach(() => {
		localStorage.removeItem(BRIDGE_DEBUG_MODE_STORAGE_KEY)
		vi.unstubAllGlobals()
	})

	it("does not send metrics from localhost or mock-backend debug mode", () => {
		expect(shouldSendBridgeMetric({ debugMode: "off", hostname: "localhost" })).toBe(false)
		expect(shouldSendBridgeMetric({ debugMode: "off", hostname: "127.0.0.1" })).toBe(false)
		expect(shouldSendBridgeMetric({ debugMode: "off", hostname: "::1" })).toBe(false)
		expect(shouldSendBridgeMetric({ debugMode: "off", hostname: "[::1]" })).toBe(false)
		expect(shouldSendBridgeMetric({ debugMode: "mock-backend", hostname: "bridge.zeko.io" })).toBe(
			false
		)
		expect(shouldSendBridgeMetric({ debugMode: "off", hostname: "bridge.zeko.io" })).toBe(true)
	})

	it("skips the network request when mock-backend debug mode is active", () => {
		const fetch = vi.fn()
		localStorage.setItem(BRIDGE_DEBUG_MODE_STORAGE_KEY, "mock-backend")
		vi.stubGlobal("fetch", fetch)

		sendMetric(
			{
				category: "transaction",
				action: "signTransaction",
				durationMs: 10,
				success: true
			},
			"B62qtest-user"
		)

		expect(fetch).not.toHaveBeenCalled()
	})

	it("still sends metrics from the production bridge host", () => {
		const fetch = vi.fn(async () => new Response())
		vi.stubGlobal("fetch", fetch)

		sendMetric(
			{
				category: "transaction",
				action: "signTransaction",
				durationMs: 10,
				success: true
			},
			"B62qtest-user",
			{ debugMode: "off", hostname: "bridge.zeko.io" }
		)

		expect(fetch).toHaveBeenCalledWith(
			"/metrics",
			expect.objectContaining({
				method: "POST",
				keepalive: true
			})
		)
	})
})
