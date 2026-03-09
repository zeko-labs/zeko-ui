import { monitorEventLoopDelay } from "node:perf_hooks"
import { runActionProcessing } from "../action-processing/runtime"
import { generateSyntheticArchiveBlocks } from "./action-processing-synthetic"

const average = (values: number[]): number =>
	values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const percentile = (values: number[], target: number): number => {
	if (values.length === 0) return 0
	const sorted = [...values].sort((a, b) => a - b)
	const index = Math.min(sorted.length - 1, Math.floor((target / 100) * sorted.length))
	return sorted[index]
}

const toMilliseconds = (value: number): number => {
	if (!Number.isFinite(value)) return 0
	return Number((value / 1e6).toFixed(2))
}

export async function runActionProcessingStress({
	durationSeconds = 5,
	blockCount = 80,
	actionsPerBlock = 8,
	fieldsPerAction = 6,
	preferWorker = true,
	workerThreads,
	strictWorker = false
}: {
	durationSeconds?: number
	blockCount?: number
	actionsPerBlock?: number
	fieldsPerAction?: number
	preferWorker?: boolean
	workerThreads?: number
	strictWorker?: boolean
} = {}) {
	const blocks = generateSyntheticArchiveBlocks({
		blockCount,
		actionsPerBlock,
		fieldsPerAction
	})

	const delayHistogram = monitorEventLoopDelay({ resolution: 20 })
	delayHistogram.enable()

	const durations: number[] = []
	let workerRuns = 0
	let mainRuns = 0
	const endAt = Date.now() + durationSeconds * 1000
	let runs = 0

	while (Date.now() < endAt) {
		const startedAt = performance.now()
		const result = await runActionProcessing({
			blocks,
			preferWorker,
			workerThreads,
			fallbackToMain: !strictWorker
		})
		if (result.stats.strategy === "worker") {
			workerRuns += 1
		} else {
			mainRuns += 1
		}
		durations.push(performance.now() - startedAt)
		runs += 1
	}

	delayHistogram.disable()

	return {
		runs,
		workload: { blockCount, actionsPerBlock, fieldsPerAction },
		workerThreadsRequested: workerThreads ?? "auto",
		strategy: {
			workerRuns,
			mainRuns
		},
		avgRunMs: Number(average(durations).toFixed(2)),
		p95RunMs: Number(percentile(durations, 95).toFixed(2)),
		maxRunMs: Number(Math.max(0, ...durations).toFixed(2)),
		eventLoopLagMs: {
			mean: toMilliseconds(delayHistogram.mean),
			p95: toMilliseconds(delayHistogram.percentile(95)),
			max: toMilliseconds(delayHistogram.max)
		}
	}
}
