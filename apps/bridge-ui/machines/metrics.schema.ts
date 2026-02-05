import * as v from "valibot"

export const MetricEventSchema = v.object({
	category: v.picklist(["bridge", "bridge_operation", "transaction"]),
	action: v.pipe(v.string(), v.maxLength(100)),
	label: v.optional(v.pipe(v.string(), v.maxLength(500))),
	durationMs: v.optional(v.pipe(v.number(), v.minValue(0))),
	amount: v.optional(v.number()),
	source: v.optional(v.pipe(v.string(), v.maxLength(100))),
	destination: v.optional(v.pipe(v.string(), v.maxLength(100))),
	success: v.optional(v.boolean()),
	walletAddress: v.optional(v.pipe(v.string(), v.maxLength(200))),
	userAgent: v.optional(v.pipe(v.string(), v.maxLength(500))),
	cpuCores: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	language: v.optional(v.pipe(v.string(), v.maxLength(50))),
	screenResolution: v.optional(v.pipe(v.string(), v.maxLength(20))),
	timestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
})

export type MetricEvent = v.InferOutput<typeof MetricEventSchema>
