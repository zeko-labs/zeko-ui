import { availableParallelism } from "node:os"
import { processArchiveBlocks } from "../action-processing/core"
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

const round = (value: number): number => Number(value.toFixed(2))

export async function runActionProcessingProof({
	blockCount = 120,
	actionsPerBlock = 12,
	fieldsPerAction = 6,
	warmupRuns = 1,
	sampleRuns = 6,
	workerThreads
}: {
	blockCount?: number
	actionsPerBlock?: number
	fieldsPerAction?: number
	warmupRuns?: number
	sampleRuns?: number
	workerThreads?: number
} = {}) {
	const blocks = generateSyntheticArchiveBlocks({
		blockCount,
		actionsPerBlock,
		fieldsPerAction
	})

	for (let index = 0; index < warmupRuns; index++) {
		processArchiveBlocks({ blocks, strategy: "main" })
		await runActionProcessing({
			blocks,
			preferWorker: true,
			workerThreads
		})
	}

	const mainDurations: number[] = []
	const workerDurations: number[] = []

	for (let index = 0; index < sampleRuns; index++) {
		const mainResult = processArchiveBlocks({ blocks, strategy: "main" })
		mainDurations.push(mainResult.stats.totalMs)

		const workerResult = await runActionProcessing({
			blocks,
			preferWorker: true,
			workerThreads
		})
		workerDurations.push(workerResult.stats.totalMs)
	}

	const mainMedianMs = round(percentile(mainDurations, 50))
	const workerMedianMs = round(percentile(workerDurations, 50))
	const mainP95Ms = round(percentile(mainDurations, 95))
	const workerP95Ms = round(percentile(workerDurations, 95))
	const speedupRatio = round(mainMedianMs / Math.max(workerMedianMs, 1))
	const passed = workerMedianMs < mainMedianMs

	return {
		environment: {
			nodeVersion: process.version,
			platform: process.platform,
			arch: process.arch,
			availableParallelism: availableParallelism()
		},
		workload: {
			blockCount,
			actionsPerBlock,
			fieldsPerAction
		},
		samples: {
			mainMs: mainDurations.map(round),
			workerMs: workerDurations.map(round)
		},
		summary: {
			warmupRuns,
			sampleRuns,
			mainAvgMs: round(average(mainDurations)),
			workerAvgMs: round(average(workerDurations)),
			mainMedianMs,
			workerMedianMs,
			mainP95Ms,
			workerP95Ms,
			speedupRatio,
			criterion: "workerMedianMs < mainMedianMs"
		},
		passed
	}
}
