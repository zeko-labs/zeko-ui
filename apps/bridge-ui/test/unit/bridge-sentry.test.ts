import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	BRIDGE_METRIC_LABEL_MAX_LENGTH,
	buildBridgeErrorFingerprint,
	captureBridgeError,
	describeBridgeError,
	describeBridgeMetricLabel,
	normalizeBridgeErrorMessage,
	shouldSkipBridgeErrorCapture
} from "../../app/telemetry/bridgeErrors"
import { QuietError } from "../../app/errors"

const captureException = vi.hoisted(() => vi.fn())
const withScope = vi.hoisted(() =>
	vi.fn(
		(
			callback: (scope: {
				setContext: (key: string, value: unknown) => void
				setFingerprint: (fingerprint: string[]) => void
				setLevel: (level: string) => void
				setTag: (key: string, value: string) => void
			}) => void
		) => {
			const result = {
				contexts: {} as Record<string, unknown>,
				fingerprint: [] as string[],
				level: "",
				tags: {} as Record<string, string>
			}
			callback({
				setContext(key, value) {
					result.contexts[key] = value
				},
				setFingerprint(fingerprint) {
					result.fingerprint = fingerprint
				},
				setLevel(level) {
					result.level = level
				},
				setTag(key, value) {
					result.tags[key] = value
				}
			})
			return result
		}
	)
)

vi.mock("@sentry/nuxt", () => ({
	captureException,
	withScope
}))

describe("bridge error telemetry", () => {
	beforeEach(() => {
		captureException.mockClear()
		withScope.mockClear()
	})

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

	it("marks handled bridge errors as app-originated for Sentry filtering", () => {
		const error = new Error("Debug scenario: claim failed")

		captureBridgeError({
			error,
			context: {
				category: "bridge_operation",
				action: "finalizeWithdrawal",
				walletAddress: "B62qtest-user",
				source: "zeko-m:testnet",
				destination: "mina:devnet",
				direction: "withdrawal"
			}
		})

		const scopeResult = withScope.mock.results.at(-1)?.value
		expect(scopeResult.tags).toMatchObject({
			app_originated: "true",
			bridge_action: "finalizeWithdrawal",
			bridge_category: "bridge_operation"
		})
		expect(captureException).toHaveBeenCalledWith(error)
	})
})
