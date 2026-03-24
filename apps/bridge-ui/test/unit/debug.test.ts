import { beforeEach, describe, expect, it, vi } from "vitest"

const telemetry = vi.hoisted(() => ({
	captureBridgeError: vi.fn(),
	describeBridgeMetricLabel: vi.fn(() => "bounded label")
}))

const metrics = vi.hoisted(() => ({
	sendMetric: vi.fn()
}))

vi.mock("../../app/telemetry/bridgeErrors", () => ({
	captureBridgeError: telemetry.captureBridgeError,
	describeBridgeMetricLabel: telemetry.describeBridgeMetricLabel
}))

vi.mock("../../machines/metrics", () => ({
	sendMetric: metrics.sendMetric
}))

import { createLogger } from "../../machines/debug"

describe("createLogger", () => {
	beforeEach(() => {
		telemetry.captureBridgeError.mockClear()
		telemetry.describeBridgeMetricLabel.mockClear()
		metrics.sendMetric.mockClear()
	})

	it("captures handled errors even when metrics are disabled", async () => {
		const logger = createLogger("[BRIDGE]")
		const error = new Error("boom")

		await expect(
			logger.act(
				"findPendingOperation",
				async () => {
					throw error
				},
				"wallet-1"
			)
		).rejects.toThrow(error)

		expect(telemetry.captureBridgeError).toHaveBeenCalledWith({
			error,
			context: {
				category: "bridge",
				action: "findPendingOperation",
				walletAddress: "wallet-1"
			}
		})
		expect(metrics.sendMetric).not.toHaveBeenCalled()
	})
})
