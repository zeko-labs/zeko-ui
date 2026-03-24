import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
	buildNorthflankLogsArgs,
	buildNorthflankMetricsArgs,
	parseMetrics,
	runNorthflankLogs
} from "../src/cli/resources"

const tempDirs: string[] = []

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map(async (dir) => {
			await rm(dir, { recursive: true, force: true })
		})
	)
})

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

	it("treats SIGINT-terminated log streams as a clean exit", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "actions-indexer-logs-"))
		tempDirs.push(tempDir)

		const executablePath = join(tempDir, "northflank")
		await writeFile(
			executablePath,
			[
				"#!/bin/sh",
				'if [ "$1" = "get" ] && [ "$2" = "service" ] && [ "$3" = "logs" ]; then',
				"  sleep 10",
				"fi"
			].join("\n")
		)
		await chmod(executablePath, 0o755)

		const interruptTimer = setTimeout(() => {
			process.kill(process.pid, "SIGINT")
		}, 100)

		try {
			await expect(
				runNorthflankLogs({
					projectId: "proj_123",
					serviceId: "svc_456",
					durationSeconds: 300,
					northflankExecutable: executablePath
				})
			).resolves.toBeUndefined()
		} finally {
			clearTimeout(interruptTimer)
		}
	}, 10_000)

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
