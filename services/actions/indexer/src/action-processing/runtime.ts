import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { availableParallelism } from "node:os"
import { fileURLToPath } from "node:url"
import * as v from "valibot"
import { processArchiveBlocks, validateEventChain } from "./core"
import {
	type ProcessRequest,
	type ProcessResponse,
	ProcessResponseSchema
} from "./process-protocol"
import type { ActionProcessingResult, ArchiveAction } from "./types"

const MAX_WORKER_PROCESSES = 4
const WORKER_PROCESS_TIMEOUT_MS = 60_000

function getProcessScriptPath(): URL {
	return new URL("./action-processing-process.js", import.meta.url)
}

function resolveWorkerThreads(blockCount: number, requested?: number): number {
	const available = Math.max(1, availableParallelism() - 1)
	const boundedByCpu = Math.min(available, MAX_WORKER_PROCESSES)
	const configured = requested && requested > 0 ? Math.floor(requested) : boundedByCpu
	return Math.max(1, Math.min(configured, blockCount))
}

function splitIntoChunks(blocks: ArchiveAction[], workerThreads: number): ArchiveAction[][] {
	if (workerThreads <= 1) return [blocks]
	const chunkSize = Math.ceil(blocks.length / workerThreads)
	const chunks: ArchiveAction[][] = []
	for (let index = 0; index < blocks.length; index += chunkSize) {
		chunks.push(blocks.slice(index, index + chunkSize))
	}
	return chunks
}

const parseProcessResponse = (stdout: string): ProcessResponse => {
	return v.parse(v.pipe(v.string(), v.parseJson(), ProcessResponseSchema), stdout)
}

async function runInDedicatedProcess(blocks: ArchiveAction[]): Promise<ActionProcessingResult> {
	const scriptPath = getProcessScriptPath()
	if (!existsSync(scriptPath)) {
		throw new Error(`action-processing process file not found at ${scriptPath.pathname}`)
	}

	const request: ProcessRequest = { blocks }
	const subprocess = spawn(process.execPath, [fileURLToPath(scriptPath)], {
		stdio: ["pipe", "pipe", "pipe"]
	})

	return new Promise<ActionProcessingResult>((resolve, reject) => {
		let stdout = ""
		let stderr = ""
		let settled = false
		const timeout = setTimeout(() => {
			subprocess.kill("SIGKILL")
			settle(() =>
				reject(
					new Error(`action-processing process timed out after ${WORKER_PROCESS_TIMEOUT_MS}ms`)
				)
			)
		}, WORKER_PROCESS_TIMEOUT_MS)
		timeout.unref?.()

		const settle = (callback: () => void) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			callback()
		}

		subprocess.stdout.on("data", (chunk: Buffer | string) => {
			stdout += chunk.toString()
		})

		subprocess.stderr.on("data", (chunk: Buffer | string) => {
			stderr += chunk.toString()
		})

		subprocess.on("error", (error) => {
			settle(() => reject(error))
		})

		subprocess.on("close", (code) => {
			settle(() => {
				if (code !== 0) {
					reject(new Error(stderr.trim() || `action-processing process exited with code ${code}`))
					return
				}

				let parsed: ProcessResponse
				try {
					parsed = parseProcessResponse(stdout)
				} catch (error) {
					reject(error)
					return
				}

				if (!parsed.ok) {
					reject(new Error(parsed.error))
					return
				}

				resolve(parsed.result)
			})
		})

		subprocess.stdin.write(JSON.stringify(request))
		subprocess.stdin.end()
	})
}

async function runInWorkerPool({
	blocks,
	workerThreads
}: {
	blocks: ArchiveAction[]
	workerThreads: number
}): Promise<ActionProcessingResult> {
	const startedAt = performance.now()
	const chunks = splitIntoChunks(blocks, workerThreads)
	const chunkResults = await Promise.all(chunks.map((chunk) => runInDedicatedProcess(chunk)))

	const validationStartedAt = performance.now()
	const events = chunkResults.flatMap((chunk) => chunk.events)
	validateEventChain(events)
	const boundaryValidationMs = performance.now() - validationStartedAt

	const hashingMs = chunkResults.reduce((total, chunk) => total + chunk.stats.hashingMs, 0)
	const validationMs =
		chunkResults.reduce((total, chunk) => total + chunk.stats.validationMs, 0) +
		boundaryValidationMs
	const totalMs = performance.now() - startedAt

	return {
		events,
		stats: {
			strategy: "worker",
			totalMs,
			hashingMs,
			validationMs,
			blocks: blocks.length,
			events: events.length,
			bottleneck: hashingMs >= validationMs ? "hashing" : "validation"
		}
	}
}

export async function runActionProcessing({
	blocks,
	preferWorker = true,
	workerThreads
}: {
	blocks: ArchiveAction[]
	preferWorker?: boolean
	workerThreads?: number
}): Promise<ActionProcessingResult> {
	if (!preferWorker || blocks.length === 0) {
		return processArchiveBlocks({ blocks, strategy: "main" })
	}

	const resolvedWorkerThreads = resolveWorkerThreads(blocks.length, workerThreads)
	return runInWorkerPool({
		blocks,
		workerThreads: resolvedWorkerThreads
	})
}
