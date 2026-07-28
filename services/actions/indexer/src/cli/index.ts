import { defineCommand, runMain } from "citty"
import * as v from "valibot"
import { runActionProcessingBench } from "../benchmark/action-processing-bench"
import { runActionProcessingProof } from "../benchmark/action-processing-proof"
import { runActionProcessingStress } from "../benchmark/action-processing-stress"
import { asString, readCliBooleanArg, readCliNumberArg } from "./args"
import { runHealthCheck, runSyncCheck } from "./checks"
import { runNorthflankLogs, runNorthflankResources } from "./resources"
import { indexerStatusFields } from "./status"

const printOutput = ({ json, table }: { json: boolean; table: Record<string, unknown>[] }) => {
	if (json) {
		console.log(JSON.stringify(table, null, 2))
		return
	}
	console.table(table)
}

const normalizeUrl = (url: string): string => url.replace(/\/+$/, "")

const JsonUnknownSchema = v.pipe(v.string(), v.parseJson(), v.unknown())

const IndexerStatusSchema = v.object({
	isRunning: v.boolean(),
	lastRunTimestamp: v.nullable(v.number()),
	lastFetchedBlock: v.object({
		outer: v.nullable(v.number()),
		inner: v.nullable(v.number()),
		registry: v.nullable(v.number())
	}),
	canonicalProgress: v.optional(
		v.object({
			checkedAt: v.nullable(v.number()),
			error: v.optional(v.string()),
			outer: v.object({
				lastFinalIndex: v.nullable(v.number()),
				lastFinalBlockHeight: v.nullable(v.number()),
				nonCanonicalTailCount: v.number()
			}),
			inner: v.object({
				lastFinalIndex: v.nullable(v.number()),
				lastFinalBlockHeight: v.nullable(v.number()),
				nonCanonicalTailCount: v.number()
			})
		})
	),
	config: v.object({
		intervalSeconds: v.number()
	}),
	consecutiveErrors: v.number()
})

const ControlResponseSchema = v.object({
	success: v.boolean(),
	message: v.string(),
	status: v.optional(IndexerStatusSchema),
	config: v.optional(
		v.object({
			intervalSeconds: v.number()
		})
	),
	actionsProcessed: v.optional(v.number())
})

const HealthPayloadSchema = v.object({
	status: v.string(),
	indexer: v.object({
		canonicalProgress: v.object({
			outer: v.object({
				lastFinalIndex: v.nullable(v.number()),
				lastFinalBlockHeight: v.nullable(v.number()),
				nonCanonicalTailCount: v.number()
			}),
			inner: v.object({
				lastFinalIndex: v.nullable(v.number()),
				lastFinalBlockHeight: v.nullable(v.number()),
				nonCanonicalTailCount: v.number()
			})
		})
	})
})

type IndexerStatus = v.InferOutput<typeof IndexerStatusSchema>
type ControlResponse = v.InferOutput<typeof ControlResponseSchema>

const defaultControlUrl = (): string => `http://127.0.0.1:${process.env.PORT ?? "3000"}`

const readRequiredAuthToken = (commandName: string): string => {
	const authToken = asString(process.env.AUTH_TOKEN)
	if (!authToken) {
		throw new Error(`${commandName} requires AUTH_TOKEN in the environment`)
	}
	return authToken
}

const parseJsonResponse = async (response: Response, label: string): Promise<unknown | null> => {
	const text = await response.text()
	if (text.length === 0) return null
	const parsed = v.safeParse(JsonUnknownSchema, text)
	if (!parsed.success) {
		throw new Error(`${label} returned invalid JSON`)
	}
	return parsed.output
}

const requireControlResponse = (payload: unknown, commandName: string): ControlResponse => {
	try {
		return v.parse(ControlResponseSchema, payload)
	} catch (error) {
		throw new Error(`${commandName} returned an unexpected response payload`, { cause: error })
	}
}

const requireIndexerStatus = (payload: unknown, commandName: string): IndexerStatus => {
	try {
		return v.parse(IndexerStatusSchema, payload)
	} catch (error) {
		throw new Error(`${commandName} returned an unexpected response payload`, { cause: error })
	}
}

const controlRequest = async ({
	args,
	commandName,
	path,
	method = "POST",
	body
}: {
	args: Record<string, unknown>
	commandName: string
	path: string
	method?: "GET" | "POST"
	body?: unknown
}): Promise<{ httpStatus: number; payload: unknown | null; json: boolean }> => {
	const url = asString(args.url) ?? defaultControlUrl()
	const timeoutMs = readCliNumberArg(args, ["timeoutMs", "timeout-ms", "timeout"], 30_000)
	const authToken = readRequiredAuthToken(commandName)
	const json = Boolean(args.json)

	const response = await fetch(`${normalizeUrl(url)}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${authToken}`,
			...(body == null ? {} : { "Content-Type": "application/json" })
		},
		body: body == null ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs)
	})
	const payload = await parseJsonResponse(response, commandName)

	if (!response.ok) {
		const parsedPayload =
			payload != null && typeof payload === "object"
				? v.safeParse(ControlResponseSchema, payload)
				: null
		const message =
			parsedPayload?.success && parsedPayload.output.message.length > 0
				? parsedPayload.output.message
				: response.statusText
		throw new Error(`${commandName} failed with HTTP ${response.status}: ${message}`)
	}

	return {
		httpStatus: response.status,
		payload,
		json
	}
}

const printControlResult = ({
	commandName,
	httpStatus,
	payload,
	json
}: {
	commandName: string
	httpStatus: number
	payload: ControlResponse
	json: boolean
}) => {
	printOutput({
		json,
		table: [
			{
				command: commandName,
				httpStatus,
				message: payload.message,
				actionsProcessed: payload.actionsProcessed ?? null,
				...indexerStatusFields(payload.status),
				intervalSeconds:
					payload.config?.intervalSeconds ?? payload.status?.config.intervalSeconds ?? null
			}
		]
	})
}

const runStatusFromArgs = async (args: Record<string, unknown>) => {
	const result = await controlRequest({
		args,
		commandName: "status",
		path: "/status",
		method: "GET"
	})
	const payload = requireIndexerStatus(result.payload, "status")

	printOutput({
		json: result.json,
		table: [
			{
				command: "status",
				httpStatus: result.httpStatus,
				...indexerStatusFields(payload)
			}
		]
	})

	return payload
}

const runStartFromArgs = async (args: Record<string, unknown>) => {
	const result = await controlRequest({
		args,
		commandName: "start",
		path: "/start"
	})
	const payload = requireControlResponse(result.payload, "start")
	printControlResult({
		commandName: "start",
		httpStatus: result.httpStatus,
		payload,
		json: result.json
	})
	return payload
}

const runStopFromArgs = async (args: Record<string, unknown>) => {
	const result = await controlRequest({
		args,
		commandName: "stop",
		path: "/stop"
	})
	const payload = requireControlResponse(result.payload, "stop")
	printControlResult({
		commandName: "stop",
		httpStatus: result.httpStatus,
		payload,
		json: result.json
	})
	return payload
}

const runResetFromArgs = async (args: Record<string, unknown>) => {
	const result = await controlRequest({
		args,
		commandName: "reset",
		path: "/reset"
	})
	const payload = requireControlResponse(result.payload, "reset")
	printControlResult({
		commandName: "reset",
		httpStatus: result.httpStatus,
		payload,
		json: result.json
	})
	return payload
}

const runRebuildFromArgs = async (args: Record<string, unknown>) => {
	const result = await controlRequest({
		args,
		commandName: "rebuild",
		path: "/rebuild"
	})
	const payload = requireControlResponse(result.payload, "rebuild")
	printControlResult({
		commandName: "rebuild",
		httpStatus: result.httpStatus,
		payload,
		json: result.json
	})
	return payload
}

const runSetIntervalFromArgs = async (args: Record<string, unknown>) => {
	const intervalSeconds = readCliNumberArg(
		args,
		["intervalSeconds", "interval-seconds", "interval"],
		0
	)
	if (intervalSeconds <= 0) {
		throw new Error("set-interval requires a positive interval-seconds value")
	}

	const result = await controlRequest({
		args,
		commandName: "set-interval",
		path: "/config",
		body: { intervalSeconds }
	})
	const payload = requireControlResponse(result.payload, "set-interval")
	printControlResult({
		commandName: "set-interval",
		httpStatus: result.httpStatus,
		payload,
		json: result.json
	})
	return payload
}

const runHealthFromArgs = async (args: Record<string, unknown>) => {
	const url = asString(args.url) ?? "https://indexer.actions.zeko.io"
	const timeoutMs = readCliNumberArg(args, ["timeoutMs", "timeout-ms", "timeout"], 8000)
	const json = Boolean(args.json)

	const health = await runHealthCheck({ baseUrl: url, timeoutMs })
	const parsedPayload =
		health.payload != null && typeof health.payload === "object"
			? v.safeParse(HealthPayloadSchema, health.payload)
			: null
	const status = parsedPayload?.success ? parsedPayload.output.status : "unknown"

	printOutput({
		json,
		table: [
			{
				check: "health",
				httpStatus: health.statusCode,
				latencyMs: health.latencyMs,
				status,
				outerLastFinalIndex: parsedPayload?.success
					? parsedPayload.output.indexer.canonicalProgress.outer.lastFinalIndex
					: null,
				outerLastFinalBlock: parsedPayload?.success
					? parsedPayload.output.indexer.canonicalProgress.outer.lastFinalBlockHeight
					: null,
				outerNonCanonicalTail: parsedPayload?.success
					? parsedPayload.output.indexer.canonicalProgress.outer.nonCanonicalTailCount
					: null,
				innerLastFinalIndex: parsedPayload?.success
					? parsedPayload.output.indexer.canonicalProgress.inner.lastFinalIndex
					: null,
				innerLastFinalBlock: parsedPayload?.success
					? parsedPayload.output.indexer.canonicalProgress.inner.lastFinalBlockHeight
					: null,
				innerNonCanonicalTail: parsedPayload?.success
					? parsedPayload.output.indexer.canonicalProgress.inner.nonCanonicalTailCount
					: null
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
		throw new Error(
			"sync requires l1-archive-url, l2-archive-url, outer-pk, and inner-pk (args or env)"
		)
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
				tipDistance: result.outer.tipDistance,
				lag: result.outer.lag,
				hasPendingActions: result.outer.hasPendingActions,
				status: result.outer.status
			},
			{
				stream: "inner",
				lastFetchedBlock: result.inner.lastFetchedBlock,
				tip: result.inner.tip,
				tipDistance: result.inner.tipDistance,
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
		throw new Error("resources requires project-id and service-id (args or env)")
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
				memoryPercent: result.memoryPercent,
				command: result.command.join(" ")
			}
		]
	})
}

const runLogsFromArgs = async (args: Record<string, unknown>) => {
	const projectId = asString(args.projectId ?? args["project-id"])
	const serviceId = asString(args.serviceId ?? args["service-id"])
	if (!projectId || !serviceId) {
		throw new Error("logs requires project-id and service-id (args or env)")
	}

	const typesValue = asString(args.types)

	await runNorthflankLogs({
		projectId,
		serviceId,
		durationSeconds: readCliNumberArg(args, ["durationSeconds", "duration-seconds"], 900),
		lineLimit: readCliNumberArg(args, ["lineLimit", "line-limit"], 200) || undefined,
		tail: readCliBooleanArg(args, ["tail"], true),
		types: typesValue
			?.split(",")
			.map((value) => value.trim())
			.filter((value) => value.length > 0) ?? ["runtime"],
		containerId: asString(args.containerId ?? args["container-id"]),
		deploymentId: asString(args.deploymentId ?? args["deployment-id"]),
		northflankExecutable:
			asString(args.northflankExecutable ?? args["northflank-executable"]) ?? "northflank"
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
		workerThreads: readCliNumberArg(args, ["workerThreads", "worker-threads"], 0) || undefined
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
		workerThreads: readCliNumberArg(args, ["workerThreads", "worker-threads"], 0) || undefined
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
		workerThreads: readCliNumberArg(args, ["workerThreads", "worker-threads"], 0) || undefined
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
		description: "Indexer operations CLI"
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
				"timeout-ms": {
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
		status: {
			meta: {
				name: "status",
				description: "Read the authenticated indexer status snapshot"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: defaultControlUrl()
				},
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "30000"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runStatusFromArgs(args as Record<string, unknown>)
		},
		start: {
			meta: {
				name: "start",
				description: "Start the authenticated indexer loop"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: defaultControlUrl()
				},
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "30000"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runStartFromArgs(args as Record<string, unknown>)
		},
		stop: {
			meta: {
				name: "stop",
				description: "Stop the authenticated indexer loop"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: defaultControlUrl()
				},
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "30000"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runStopFromArgs(args as Record<string, unknown>)
		},
		reset: {
			meta: {
				name: "reset",
				description: "Stop the indexer, clear indexed data, and restart from scratch"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: defaultControlUrl()
				},
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "30000"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runResetFromArgs(args as Record<string, unknown>)
		},
		rebuild: {
			meta: {
				name: "rebuild",
				description: "Stop the indexer, rebuild indexed data from archive sources, then resume"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: defaultControlUrl()
				},
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "30000"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runRebuildFromArgs(args as Record<string, unknown>)
		},
		"set-interval": {
			meta: {
				name: "set-interval",
				description: "Update the authenticated indexer polling interval"
			},
			args: {
				url: {
					type: "string",
					description: "Indexer base URL",
					default: defaultControlUrl()
				},
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "30000"
				},
				"interval-seconds": {
					type: "string",
					description: "Polling interval in seconds",
					default: "15"
				},
				json: {
					type: "boolean",
					description: "Output as JSON",
					default: false
				}
			},
			run: async ({ args }) => runSetIntervalFromArgs(args as Record<string, unknown>)
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
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "8000"
				},
				"l1-archive-url": {
					type: "string",
					description: "L1 archive URL",
					default: process.env.L1_ARCHIVE_URL
				},
				"l2-archive-url": {
					type: "string",
					description: "L2 archive URL",
					default: process.env.L2_ARCHIVE_URL
				},
				"outer-pk": {
					type: "string",
					description: "Outer action public key",
					default: process.env.OUTER_PK
				},
				"inner-pk": {
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
				"project-id": {
					type: "string",
					description: "Northflank project ID",
					default: process.env.NORTHFLANK_PROJECT_ID
				},
				"service-id": {
					type: "string",
					description: "Northflank service ID",
					default: process.env.NORTHFLANK_SERVICE_ID
				},
				"duration-seconds": {
					type: "string",
					description: "Metrics duration window in seconds",
					default: "900"
				},
				"northflank-executable": {
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
		logs: {
			meta: {
				name: "logs",
				description: "Stream service logs through the Northflank CLI"
			},
			args: {
				"project-id": {
					type: "string",
					description: "Northflank project ID",
					default: process.env.NORTHFLANK_PROJECT_ID
				},
				"service-id": {
					type: "string",
					description: "Northflank service ID",
					default: process.env.NORTHFLANK_SERVICE_ID
				},
				"duration-seconds": {
					type: "string",
					description: "Log lookback window in seconds",
					default: "900"
				},
				"line-limit": {
					type: "string",
					description: "Maximum number of historical lines to fetch before tailing",
					default: "200"
				},
				tail: {
					type: "boolean",
					description: "Keep streaming logs in real time",
					default: true
				},
				types: {
					type: "string",
					description: "Comma-separated log types",
					default: "runtime"
				},
				"container-id": {
					type: "string",
					description: "Optional container ID"
				},
				"deployment-id": {
					type: "string",
					description: "Optional deployment ID"
				},
				"northflank-executable": {
					type: "string",
					description: "Northflank executable name",
					default: "northflank"
				}
			},
			run: async ({ args }) => runLogsFromArgs(args as Record<string, unknown>)
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
				"timeout-ms": {
					type: "string",
					description: "Request timeout in milliseconds",
					default: "8000"
				},
				"l1-archive-url": {
					type: "string",
					description: "L1 archive URL",
					default: process.env.L1_ARCHIVE_URL
				},
				"l2-archive-url": {
					type: "string",
					description: "L2 archive URL",
					default: process.env.L2_ARCHIVE_URL
				},
				"outer-pk": {
					type: "string",
					description: "Outer action public key",
					default: process.env.OUTER_PK
				},
				"inner-pk": {
					type: "string",
					description: "Inner action public key",
					default: process.env.INNER_PK
				},
				"project-id": {
					type: "string",
					description: "Northflank project ID",
					default: process.env.NORTHFLANK_PROJECT_ID
				},
				"service-id": {
					type: "string",
					description: "Northflank service ID",
					default: process.env.NORTHFLANK_SERVICE_ID
				},
				"duration-seconds": {
					type: "string",
					description: "Metrics duration window in seconds",
					default: "900"
				},
				"northflank-executable": {
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
				"block-count": {
					type: "string",
					description: "Number of synthetic blocks",
					default: "120"
				},
				"actions-per-block": {
					type: "string",
					description: "Actions per synthetic block",
					default: "12"
				},
				"fields-per-action": {
					type: "string",
					description: "Field count per action payload",
					default: "6"
				},
				iterations: {
					type: "string",
					description: "Benchmark iterations",
					default: "2"
				},
				"worker-threads": {
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
			run: async ({ args }) => runActionProcessingBenchFromArgs(args as Record<string, unknown>)
		},
		"action-processing-stress": {
			meta: {
				name: "action-processing-stress",
				description: "Stress test the indexer action-processing workload"
			},
			args: {
				"duration-seconds": {
					type: "string",
					description: "Stress duration in seconds",
					default: "5"
				},
				"block-count": {
					type: "string",
					description: "Number of synthetic blocks",
					default: "80"
				},
				"actions-per-block": {
					type: "string",
					description: "Actions per synthetic block",
					default: "8"
				},
				"fields-per-action": {
					type: "string",
					description: "Field count per action payload",
					default: "6"
				},
				"prefer-worker": {
					type: "boolean",
					description: "Use worker execution path",
					default: true
				},
				"worker-threads": {
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
			run: async ({ args }) => runActionProcessingStressFromArgs(args as Record<string, unknown>)
		},
		"action-processing-proof": {
			meta: {
				name: "action-processing-proof",
				description: "Prove IPC worker path is faster than main-thread processing"
			},
			args: {
				"block-count": {
					type: "string",
					description: "Number of synthetic blocks",
					default: "120"
				},
				"actions-per-block": {
					type: "string",
					description: "Actions per synthetic block",
					default: "12"
				},
				"fields-per-action": {
					type: "string",
					description: "Field count per action payload",
					default: "6"
				},
				"warmup-runs": {
					type: "string",
					description: "Unmeasured warmup runs before sampling",
					default: "1"
				},
				"sample-runs": {
					type: "string",
					description: "Measured runs used for proof",
					default: "6"
				},
				"worker-threads": {
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
