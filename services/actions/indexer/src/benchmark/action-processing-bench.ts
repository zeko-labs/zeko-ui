import { processArchiveBlocks } from "../action-processing/core"
import { runActionProcessing } from "../action-processing/runtime"
import { generateSyntheticArchiveBlocks } from "./action-processing-synthetic"

interface BenchSample {
	totalMs: number
	hashingMs: number
	validationMs: number
	strategy: "main" | "worker"
}

const average = (values: number[]): number =>
	values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const percentile = (values: number[], target: number): number => {
	if (values.length === 0) return 0
	const sorted = [...values].sort((a, b) => a - b)
	const index = Math.min(sorted.length - 1, Math.floor((target / 100) * sorted.length))
	return sorted[index]
}

const summarize = (samples: BenchSample[]) => ({
	avgMs: Number(average(samples.map((sample) => sample.totalMs)).toFixed(2)),
	p95Ms: Number(
		percentile(
			samples.map((sample) => sample.totalMs),
			95
		).toFixed(2)
	),
	hashingAvgMs: Number(average(samples.map((sample) => sample.hashingMs)).toFixed(2)),
	validationAvgMs: Number(average(samples.map((sample) => sample.validationMs)).toFixed(2))
})

export async function runActionProcessingBench({
	blockCount = 120,
	actionsPerBlock = 12,
	fieldsPerAction = 6,
	iterations = 2,
	workerThreads
}: {
	blockCount?: number
	actionsPerBlock?: number
	fieldsPerAction?: number
	iterations?: number
	workerThreads?: number
} = {}) {
	const blocks = generateSyntheticArchiveBlocks({
		blockCount,
		actionsPerBlock,
		fieldsPerAction
	})

	const mainSamples: BenchSample[] = []
	for (let index = 0; index < iterations; index++) {
		const result = processArchiveBlocks({ blocks, strategy: "main" })
		mainSamples.push({
			totalMs: result.stats.totalMs,
			hashingMs: result.stats.hashingMs,
			validationMs: result.stats.validationMs,
			strategy: result.stats.strategy
		})
	}

	const workerSamples: BenchSample[] = []
	for (let index = 0; index < iterations; index++) {
		const result = await runActionProcessing({
			blocks,
			preferWorker: true,
			workerThreads
		})
		workerSamples.push({
			totalMs: result.stats.totalMs,
			hashingMs: result.stats.hashingMs,
			validationMs: result.stats.validationMs,
			strategy: result.stats.strategy
		})
	}

	const mainSummary = summarize(mainSamples)
	const workerSummary = summarize(workerSamples)
	const bottleneck =
		mainSummary.hashingAvgMs >= mainSummary.validationAvgMs ? "hashing" : "validation"

	return {
		workload: {
			blockCount,
			actionsPerBlock,
			fieldsPerAction,
			iterations,
			eventsPerRun: blockCount * actionsPerBlock
		},
		workerThreadsRequested: workerThreads ?? "auto",
		bottleneck,
		main: mainSummary,
		worker: workerSummary,
		workerSpeedup: Number((mainSummary.avgMs / Math.max(workerSummary.avgMs, 1)).toFixed(2))
	}
}
