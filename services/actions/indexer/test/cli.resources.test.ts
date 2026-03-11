import { describe, expect, it } from "vitest"
import {
	buildNorthflankLogsArgs,
	buildNorthflankMetricsArgs,
	parseMetrics
} from "../src/cli/resources"

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

	it("builds northflank log args", () => {
		const args = buildNorthflankLogsArgs({
			projectId: "proj_123",
			serviceId: "svc_456",
			durationSeconds: 300,
			lineLimit: 200,
			tail: true,
			types: ["runtime"],
			containerId: "container-1",
			deploymentId: "deployment-1"
		})

		expect(args).toEqual([
			"get",
			"service",
			"logs",
			"--project",
			"proj_123",
			"--service",
			"svc_456",
			"--container",
			"container-1",
			"--deployment",
			"deployment-1",
			"-t",
			"runtime",
			"--duration",
			"300",
			"-l",
			"200",
			"-f"
		])
	})

	it("parses CPU and memory percentages from northflank metrics JSON", () => {
		const parsed = parseMetrics({
			cpu: {
				metricInfo: { metricUnit: "pct" },
				values: [{ data: [{ value: 99.9 }] }]
			},
			memory: {
				metricInfo: { metricUnit: "pct" },
				values: [{ data: [{ value: 32.2 }] }]
			}
		})

		expect(parsed).toEqual({
			cpuPercent: 99.9,
			memoryPercent: 32.2
		})
	})
})
