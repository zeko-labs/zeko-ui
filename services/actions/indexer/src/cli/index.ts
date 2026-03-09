import { defineCommand, runMain } from "citty"
import { runActionProcessingBench } from "../benchmark/action-processing-bench"
import { runActionProcessingProof } from "../benchmark/action-processing-proof"
import { runActionProcessingStress } from "../benchmark/action-processing-stress"
import { asString, readCliBooleanArg, readCliNumberArg } from "./args"
import { runHealthCheck, runSyncCheck } from "./checks"
import { runNorthflankResources } from "./resources"

const printOutput = ({ json, table }: { json: boolean; table: Record<string, unknown>[] }) => {
	if (json) {
		console.log(JSON.stringify(table, null, 2))
		return
	}
	console.table(table)
}

const runHealthFromArgs = async (args: Record<string, unknown>) => {
	const url = asString(args.url) ?? "https://indexer.actions.zeko.io"
	const timeoutMs = readCliNumberArg(args, ["timeoutMs", "timeout-ms", "timeout"], 8000)
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
	const l1ArchiveUrl = asString(args.l1ArchiveUrl ?? args["l1-archive-url"])
	const l2ArchiveUrl = asString(args.l2ArchiveUrl ?? args["l2-archive-url"])
	const outerPk = asString(args.outerPk ?? args["outer-pk"])
	const innerPk = asString(args.innerPk ?? args["inner-pk"])

	if (!l1ArchiveUrl || !l2ArchiveUrl || !outerPk || !innerPk) {
		throw new Error("sync requires l1ArchiveUrl, l2ArchiveUrl, outerPk, and innerPk (args or env)")
	}

	const result = await runSyncCheck({
		baseUrl: asString(args.url) ?? "https://indexer.actions.zeko.io",
		timeoutMs: readCliNumberArg(args, ["timeoutMs", "timeout-ms", "timeout"], 8000),
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
	const projectId = asString(args.projectId ?? args["project-id"])
	const serviceId = asString(args.serviceId ?? args["service-id"])
	if (!projectId || !serviceId) {
		throw new Error("resources requires projectId and serviceId (args or env)")
	}

	const result = await runNorthflankResources({
		projectId,
		serviceId,
		durationSeconds: readCliNumberArg(args, ["durationSeconds", "duration-seconds"], 900),
		northflankExecutable:
			asString(args.northflankExecutable ?? args["northflank-executable"]) ?? "northflank"
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
		blockCount: readCliNumberArg(args, ["blockCount", "block-count"], 120),
		actionsPerBlock: readCliNumberArg(args, ["actionsPerBlock", "actions-per-block"], 12),
		fieldsPerAction: readCliNumberArg(args, ["fieldsPerAction", "fields-per-action"], 6),
		iterations: readCliNumberArg(args, ["iterations"], 2),
		workerThreads: readCliNumberArg(args, ["workerThreads", "worker-threads"], 0) || undefined,
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
		durationSeconds: readCliNumberArg(args, ["durationSeconds", "duration-seconds"], 5),
		blockCount: readCliNumberArg(args, ["blockCount", "block-count"], 80),
		actionsPerBlock: readCliNumberArg(args, ["actionsPerBlock", "actions-per-block"], 8),
		fieldsPerAction: readCliNumberArg(args, ["fieldsPerAction", "fields-per-action"], 6),
		preferWorker: readCliBooleanArg(args, ["preferWorker", "prefer-worker"], true),
		workerThreads: readCliNumberArg(args, ["workerThreads", "worker-threads"], 0) || undefined,
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

const runActionProcessingProofFromArgs = async (args: Record<string, unknown>) => {
	const result = await runActionProcessingProof({
		blockCount: readCliNumberArg(args, ["blockCount", "block-count"], 120),
		actionsPerBlock: readCliNumberArg(args, ["actionsPerBlock", "actions-per-block"], 12),
		fieldsPerAction: readCliNumberArg(args, ["fieldsPerAction", "fields-per-action"], 6),
		warmupRuns: readCliNumberArg(args, ["warmupRuns", "warmup-runs"], 1),
		sampleRuns: readCliNumberArg(args, ["sampleRuns", "sample-runs"], 6),
		workerThreads: readCliNumberArg(args, ["workerThreads", "worker-threads"], 0) || undefined,
		strictWorker: true
	})

	if (args.json) {
		console.log(JSON.stringify(result, null, 2))
	} else {
		printOutput({
			json: false,
			table: [
				{
					check: "action-processing-proof",
					mainMedianMs: result.summary.mainMedianMs,
					workerMedianMs: result.summary.workerMedianMs,
					mainP95Ms: result.summary.mainP95Ms,
					workerP95Ms: result.summary.workerP95Ms,
					speedupRatio: result.summary.speedupRatio,
					workerFallbackCount: result.summary.workerFallbackCount,
					passed: result.passed
				}
			]
		})
	}

	if (!result.passed) {
		throw new Error(
			`action-processing proof failed: worker median (${result.summary.workerMedianMs}ms) must be lower than main median (${result.summary.mainMedianMs}ms)`
		)
	}
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
		},
		"action-processing-proof": {
			meta: {
				name: "action-processing-proof",
				description: "Prove IPC worker path is faster than main-thread processing"
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
				warmupRuns: {
					type: "string",
					description: "Unmeasured warmup runs before sampling",
					default: "1"
				},
				sampleRuns: {
					type: "string",
					description: "Measured runs used for proof",
					default: "6"
				},
				workerThreads: {
					type: "string",
					description: "Worker process count (0 = auto)",
					default: "0"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runActionProcessingProofFromArgs(args as Record<string, unknown>)
		}
	}
})

runMain(command)
