import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { MetricEventSchema } from "../../machines/metrics.schema"

describe("MetricEventSchema", () => {
	it("accepts transaction machine metrics", () => {
		const result = v.safeParse(MetricEventSchema, {
			category: "transaction",
			action: "signTransaction",
			durationMs: 10,
			success: true,
			timestamp: Date.now()
		})

		expect(result.success).toBe(true)
	})
})
