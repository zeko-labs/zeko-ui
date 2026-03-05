import { defineCommand, runMain } from "citty"
import { runActionProcessingBench } from "./action-processing/bench"
import { runActionProcessingStress } from "./action-processing/stress"
import { runHealthCheck, runSyncCheck } from "./cli/checks"
import { runNorthflankResources } from "./cli/resources"

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined

const asNumber = (value: unknown, fallback: number): number => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

const pickArg = (args: Record<string, unknown>, camelCase: string, kebabCase: string): unknown =>
	args[camelCase] ?? args[kebabCase]

const readFlagValue = (flag: string): string | undefined => {
	const index = process.argv.indexOf(flag)
	if (index === -1) return undefined
	return process.argv[index + 1]
}

const readNumericArg = ({
	args,
	camelCase,
	kebabCase,
	fallback
}: {
	args: Record<string, unknown>
	camelCase: string
	kebabCase: string
	fallback: number
}): number =>
	asNumber(
		readFlagValue(`--${kebabCase}`) ??
			readFlagValue(`--${camelCase}`) ??
			pickArg(args, camelCase, kebabCase),
		fallback
	)

const readBooleanArg = ({
	args,
	camelCase,
	kebabCase,
	fallback
}: {
	args: Record<string, unknown>
	camelCase: string
	kebabCase: string
	fallback: boolean
}): boolean => {
	const raw =
		readFlagValue(`--${kebabCase}`) ??
		readFlagValue(`--${camelCase}`) ??
		pickArg(args, camelCase, kebabCase)
	if (raw == null) return fallback
	if (typeof raw === "boolean") return raw
	if (typeof raw === "string") {
		return raw === "true" || raw === "1"
	}
	return fallback
}

const printOutput = ({ json, table }: { json: boolean; table: Record<string, unknown>[] }) => {
	if (json) {
		console.log(JSON.stringify(table, null, 2))
		return
	}
	console.table(table)
}

const runHealthFromArgs = async (args: Record<string, unknown>) => {
	const url = asString(args.url) ?? "https://indexer.actions.zeko.io"
	const timeoutMs = asNumber(
		readFlagValue("--timeout-ms") ??
			readFlagValue("--timeout") ??
			pickArg(args, "timeoutMs", "timeout-ms"),
		8000
	)
	const json = Boolean(args.json)

	const health = await runHealthCheck({ baseUrl: url, timeoutMs })
	const status =
		typeof health.payload === "object" && health.payload && "status" in health.payload
			? String((health.payload as { status: unknown }).status)
			: "unknown"

	printOutput({
		json,
		table: [
			{
				check: "health",
				httpStatus: health.statusCode,
				latencyMs: health.latencyMs,
				status
			}
		]
	})

	if (health.statusCode >= 500) {
		throw new Error(`health check failed with HTTP ${health.statusCode}`)
	}

	return health
}

const runSyncFromArgs = async (args: Record<string, unknown>) => {
	const l1ArchiveUrl = asString(pickArg(args, "l1ArchiveUrl", "l1-archive-url"))
	const l2ArchiveUrl = asString(pickArg(args, "l2ArchiveUrl", "l2-archive-url"))
	const outerPk = asString(pickArg(args, "outerPk", "outer-pk"))
	const innerPk = asString(pickArg(args, "innerPk", "inner-pk"))

	if (!l1ArchiveUrl || !l2ArchiveUrl || !outerPk || !innerPk) {
		throw new Error("sync requires l1ArchiveUrl, l2ArchiveUrl, outerPk, and innerPk (args or env)")
	}

	const result = await runSyncCheck({
		baseUrl: asString(args.url) ?? "https://indexer.actions.zeko.io",
		timeoutMs: asNumber(
			readFlagValue("--timeout-ms") ??
				readFlagValue("--timeout") ??
				pickArg(args, "timeoutMs", "timeout-ms"),
			8000
		),
		l1ArchiveUrl,
		l2ArchiveUrl,
		outerPk,
		innerPk
	})

	printOutput({
		json: Boolean(args.json),
		table: [
			{
				stream: "outer",
				lastFetchedBlock: result.outer.lastFetchedBlock,
				tip: result.outer.tip,
				lag: result.outer.lag,
				hasPendingActions: result.outer.hasPendingActions,
				status: result.outer.status
			},
			{
				stream: "inner",
				lastFetchedBlock: result.inner.lastFetchedBlock,
				tip: result.inner.tip,
				lag: result.inner.lag,
				hasPendingActions: result.inner.hasPendingActions,
				status: result.inner.status
			}
		]
	})

	if (result.outer.status === "behind" || result.inner.status === "behind") {
		throw new Error("sync check failed: indexer has pending actions to index")
	}
}

const runResourcesFromArgs = async (args: Record<string, unknown>) => {
	const projectId = asString(pickArg(args, "projectId", "project-id"))
	const serviceId = asString(pickArg(args, "serviceId", "service-id"))
	if (!projectId || !serviceId) {
		throw new Error("resources requires projectId and serviceId (args or env)")
	}

	const result = await runNorthflankResources({
		projectId,
		serviceId,
		durationSeconds: asNumber(pickArg(args, "durationSeconds", "duration-seconds"), 900),
		northflankExecutable:
			asString(pickArg(args, "northflankExecutable", "northflank-executable")) ?? "northflank"
	})

	printOutput({
		json: Boolean(args.json),
		table: [
			{
				check: "resources",
				cpuPercent: result.cpuPercent,
				memoryMb: result.memoryMb,
				command: result.command.join(" ")
			}
		]
	})
}

const runDiagnoseFromArgs = async (args: Record<string, unknown>) => {
	await runHealthFromArgs(args)
	await runSyncFromArgs(args)
	await runResourcesFromArgs(args)
}

const runActionProcessingBenchFromArgs = async (args: Record<string, unknown>) => {
	const result = await runActionProcessingBench({
		blockCount: readNumericArg({
			args,
			camelCase: "blockCount",
			kebabCase: "block-count",
			fallback: 120
		}),
		actionsPerBlock: readNumericArg({
			args,
			camelCase: "actionsPerBlock",
			kebabCase: "actions-per-block",
			fallback: 12
		}),
		fieldsPerAction: readNumericArg({
			args,
			camelCase: "fieldsPerAction",
			kebabCase: "fields-per-action",
			fallback: 6
		}),
		iterations: readNumericArg({
			args,
			camelCase: "iterations",
			kebabCase: "iterations",
			fallback: 2
		}),
		workerThreads:
			readNumericArg({
				args,
				camelCase: "workerThreads",
				kebabCase: "worker-threads",
				fallback: 0
			}) || undefined,
		strictWorker: true
	})

	printOutput({
		json: Boolean(args.json),
		table: [
			{
				check: "action-processing-bench",
				eventsPerRun: result.workload.eventsPerRun,
				iterations: result.workload.iterations,
				bottleneck: result.bottleneck,
				workerThreadsRequested: result.workerThreadsRequested,
				workerFallbackCount: result.workerFallbackCount,
				mainAvgMs: result.main.avgMs,
				workerAvgMs: result.worker.avgMs,
				workerSpeedup: result.workerSpeedup
			}
		]
	})
}

const runActionProcessingStressFromArgs = async (args: Record<string, unknown>) => {
	const result = await runActionProcessingStress({
		durationSeconds: readNumericArg({
			args,
			camelCase: "durationSeconds",
			kebabCase: "duration-seconds",
			fallback: 5
		}),
		blockCount: readNumericArg({
			args,
			camelCase: "blockCount",
			kebabCase: "block-count",
			fallback: 80
		}),
		actionsPerBlock: readNumericArg({
			args,
			camelCase: "actionsPerBlock",
			kebabCase: "actions-per-block",
			fallback: 8
		}),
		fieldsPerAction: readNumericArg({
			args,
			camelCase: "fieldsPerAction",
			kebabCase: "fields-per-action",
			fallback: 6
		}),
		preferWorker: readBooleanArg({
			args,
			camelCase: "preferWorker",
			kebabCase: "prefer-worker",
			fallback: true
		}),
		workerThreads:
			readNumericArg({
				args,
				camelCase: "workerThreads",
				kebabCase: "worker-threads",
				fallback: 0
			}) || undefined,
		strictWorker: true
	})

	printOutput({
		json: Boolean(args.json),
		table: [
			{
				check: "action-processing-stress",
				runs: result.runs,
				workerThreadsRequested: result.workerThreadsRequested,
				workerRuns: result.strategy.workerRuns,
				mainRuns: result.strategy.mainRuns,
				avgRunMs: result.avgRunMs,
				p95RunMs: result.p95RunMs,
				maxRunMs: result.maxRunMs,
				eventLoopLagMeanMs: result.eventLoopLagMs.mean,
				eventLoopLagP95Ms: result.eventLoopLagMs.p95,
				eventLoopLagMaxMs: result.eventLoopLagMs.max
			}
		]
	})
}

const command = defineCommand({
	meta: {
		name: "actions-indexer",
		version: "1.0.0",
		description: "Indexer diagnostics CLI"
	},
	subCommands: {
		health: {
			meta: {
				name: "health",
				description: "Check the indexer /health endpoint"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: "https://indexer.actions.zeko.io"
				},
				timeoutMs: {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "8000"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => {
				await runHealthFromArgs(args as Record<string, unknown>)
			}
		},
		sync: {
			meta: {
				name: "sync",
				description: "Compare indexed heads against archive tips"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: "https://indexer.actions.zeko.io"
				},
				timeoutMs: {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "8000"
				},
				l1ArchiveUrl: {
					type: "string",
					description: "L1 archive URL",
					default: process.env.L1_ARCHIVE_URL
				},
				l2ArchiveUrl: {
					type: "string",
					description: "L2 archive URL",
					default: process.env.L2_ARCHIVE_URL
				},
				outerPk: {
					type: "string",
					description: "Outer action public key",
					default: process.env.OUTER_PK
				},
				innerPk: {
					type: "string",
					description: "Inner action public key",
					default: process.env.INNER_PK
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runSyncFromArgs(args as Record<string, unknown>)
		},
		resources: {
			meta: {
				name: "resources",
				description: "Fetch CPU/RAM resources from Northflank CLI"
			},
			args: {
				projectId: {
					type: "string",
					description: "Northflank project ID",
					default: process.env.NORTHFLANK_PROJECT_ID
				},
				serviceId: {
					type: "string",
					description: "Northflank service ID",
					default: process.env.NORTHFLANK_SERVICE_ID
				},
				durationSeconds: {
					type: "string",
					description: "Metrics duration window in seconds",
					default: "900"
				},
				northflankExecutable: {
					type: "string",
					description: "Northflank executable name",
					default: "northflank"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runResourcesFromArgs(args as Record<string, unknown>)
		},
		diagnose: {
			meta: {
				name: "diagnose",
				description: "Run health, sync, and resource checks"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: "https://indexer.actions.zeko.io"
				},
				timeoutMs: {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "8000"
				},
				l1ArchiveUrl: {
					type: "string",
					description: "L1 archive URL",
					default: process.env.L1_ARCHIVE_URL
				},
				l2ArchiveUrl: {
					type: "string",
					description: "L2 archive URL",
					default: process.env.L2_ARCHIVE_URL
				},
				outerPk: {
					type: "string",
					description: "Outer action public key",
					default: process.env.OUTER_PK
				},
				innerPk: {
					type: "string",
					description: "Inner action public key",
					default: process.env.INNER_PK
				},
				projectId: {
					type: "string",
					description: "Northflank project ID",
					default: process.env.NORTHFLANK_PROJECT_ID
				},
				serviceId: {
					type: "string",
					description: "Northflank service ID",
					default: process.env.NORTHFLANK_SERVICE_ID
				},
				durationSeconds: {
					type: "string",
					description: "Metrics duration window in seconds",
					default: "900"
				},
				northflankExecutable: {
					type: "string",
					description: "Northflank executable name",
					default: "northflank"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runDiagnoseFromArgs(args as Record<string, unknown>)
		},
		"action-processing-bench": {
			meta: {
				name: "action-processing-bench",
				description: "Benchmark the indexer action-processing workload"
			},
			args: {
				blockCount: {
					type: "string",
					description: "Number of synthetic blocks",
					default: "120"
				},
				actionsPerBlock: {
					type: "string",
					description: "Actions per synthetic block",
					default: "12"
				},
				fieldsPerAction: {
					type: "string",
					description: "Field count per action payload",
					default: "6"
				},
				iterations: {
					type: "string",
					description: "Benchmark iterations",
					default: "2"
				},
				workerThreads: {
					type: "string",
					description: "Worker thread count (0 = auto)",
					default: "0"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runActionProcessingBenchFromArgs(args as Record<string, unknown>)
		},
		"action-processing-stress": {
			meta: {
				name: "action-processing-stress",
				description: "Stress test the indexer action-processing workload"
			},
			args: {
				durationSeconds: {
					type: "string",
					description: "Stress duration in seconds",
					default: "5"
				},
				blockCount: {
					type: "string",
					description: "Number of synthetic blocks",
					default: "80"
				},
				actionsPerBlock: {
					type: "string",
					description: "Actions per synthetic block",
					default: "8"
				},
				fieldsPerAction: {
					type: "string",
					description: "Field count per action payload",
					default: "6"
				},
				preferWorker: {
					type: "boolean",
					description: "Use worker execution path",
					default: true
				},
				workerThreads: {
					type: "string",
					description: "Worker thread count (0 = auto)",
					default: "0"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runActionProcessingStressFromArgs(args as Record<string, unknown>)
		}
	}
})

runMain(command)
