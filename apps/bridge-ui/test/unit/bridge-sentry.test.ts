import { describe, expect, it } from "vitest"
import {
	BRIDGE_METRIC_LABEL_MAX_LENGTH,
	buildBridgeErrorFingerprint,
	describeBridgeError,
	describeBridgeMetricLabel,
	normalizeBridgeErrorMessage,
	shouldSkipBridgeErrorCapture
} from "../../app/telemetry/bridgeErrors"
import { QuietError } from "../../app/errors"

describe("bridge error telemetry", () => {
	it("normalizes large numeric payloads for grouping", () => {
		const message =
			"rangeCheckN: expected field to fit in 64 bits, got 28948022309329048855892746252171976963363056481941560715954676764349637630337."

		expect(normalizeBridgeErrorMessage(message)).toBe(
			"rangeCheckN: expected field to fit in 64 bits, got <bigint>."
		)
	})

	it("describes non-Error objects using their message when available", () => {
		expect(describeBridgeError({ code: 500, message: "Unknown Error: {}" })).toBe(
			"Unknown Error: {}"
		)
	})

	it("serializes non-Error objects instead of collapsing them to object-object", () => {
		expect(describeBridgeError({ code: 500, detail: { reason: "Unknown Error: {}" } })).toBe(
			'Non-Error object: {"code":500,"detail":{"reason":"Unknown Error: {}"}}'
		)
	})

	it("bounds metric labels so they still satisfy the analytics schema", () => {
		const oversizedError = {
			detail: {
				payload: "x".repeat(BRIDGE_METRIC_LABEL_MAX_LENGTH * 2)
			}
		}

		const metricLabel = describeBridgeMetricLabel(oversizedError)

		expect(metricLabel.length).toBe(BRIDGE_METRIC_LABEL_MAX_LENGTH)
		expect(metricLabel.endsWith("...")).toBe(true)
	})

	it("builds a stable fingerprint from normalized bridge context", () => {
		expect(
			buildBridgeErrorFingerprint({
				category: "bridge_operation",
				action: "finalizeWithdrawal",
				message:
					"rangeCheckN: expected field to fit in 64 bits, got 28948022309329048855892746252171976963363056481941560715954676764349637630337."
			})
		).toEqual([
			"bridge-ui",
			"bridge_operation",
			"finalizeWithdrawal",
			"rangeCheckN: expected field to fit in 64 bits, got <bigint>."
		])
	})

	it("skips explicit QuietError instances", () => {
		expect(shouldSkipBridgeErrorCapture(new QuietError("User rejected the request"))).toBe(true)
	})
})
