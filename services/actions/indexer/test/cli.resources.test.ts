import { describe, expect, it } from "vitest"
import { buildNorthflankMetricsArgs } from "../src/cli/resources"

describe("resources command", () => {
	it("builds northflank metrics args", () => {
		const args = buildNorthflankMetricsArgs({
			projectId: "proj_123",
			serviceId: "svc_456",
			durationSeconds: 900
		})

		expect(args).toEqual([
			"get",
			"service",
			"metrics",
			"--project",
			"proj_123",
			"--service",
			"svc_456",
			"-t",
			"cpu",
			"-t",
			"memory",
			"--duration",
			"900",
			"-o",
			"json"
		])
	})
})
