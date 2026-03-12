import { describe, expect, it } from "vitest"
import { classifyAeErrorRow } from "../../observability/bridge-metrics/sentry/classify-ae-error"

describe("bridge AE error audit classification", () => {
	it("marks root bridge proof-data failures as capture-worthy", () => {
		expect(
			classifyAeErrorRow({
				category: "bridge",
				action: "findPendingOperation",
				label: "Invalid witnesses data",
				occurrences: 312
			})
		).toMatchObject({
			expectedSentryBehavior: "should-capture",
			currentBehavior: "correct"
		})
	})

	it("keeps synthetic failed rollups out of standalone Sentry issue creation", () => {
		expect(
			classifyAeErrorRow({
				category: "bridge_operation",
				action: "failed",
				label: "unknown error",
				occurrences: 46
			})
		).toMatchObject({
			expectedSentryBehavior: "should-not-capture",
			currentBehavior: "correct"
		})
	})

	it("treats object-shaped signTransaction failures as a capture bug", () => {
		expect(
			classifyAeErrorRow({
				category: "transaction",
				action: "signTransaction",
				label: "[object Object]",
				occurrences: 14
			})
		).toMatchObject({
			expectedSentryBehavior: "should-capture",
			currentBehavior: "correct"
		})
	})
})
