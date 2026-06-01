import { EventEmitter } from "node:events"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ArchiveAction, ArchiveEvent } from "../src/action-processing/types"

class FakeField {
	#value: string

	constructor(value: string) {
		this.#value = value
	}

	toString() {
		return this.#value
	}

	equals(other: FakeField) {
		return {
			toBoolean: () => this.#value === other.toString()
		}
	}
}

interface MockChildProcess extends EventEmitter {
	stdout: EventEmitter
	stderr: EventEmitter
	stdin: {
		write: (chunk: string) => void
		end: () => void
	}
}

const hashValues = (values: string[]): string => values.join(",")
const nextState = (beforeState: string, values: string[]): string =>
	`${beforeState}|${hashValues(values)}`

const makeBlocks = (): ArchiveAction[] => {
	let chainState = "0"
	const blocks: ArchiveAction[] = []

	for (let blockIndex = 0; blockIndex < 2; blockIndex++) {
		const blockBeforeState = chainState
		const actionData = Array.from({ length: 2 }, (_, actionIndex) => {
			const values = [`${blockIndex}`, `${actionIndex}`, `${blockIndex + actionIndex + 1}`]
			chainState = nextState(chainState, values)
			return {
				data: values,
				transactionInfo: { hash: `txn-${blockIndex}-${actionIndex}` }
			}
		})

		blocks.push({
			blockInfo: {
				timestamp: String(1_700_000_000_000 + blockIndex),
				height: blockIndex + 1,
				distanceFromMaxBlockHeight: 2 - blockIndex
			},
			actionState: {
				actionStateOne: chainState,
				actionStateTwo: blockBeforeState
			},
			actionData
		})
	}

	return blocks
}

const makeEvents = (blocks: ArchiveAction[]): ArchiveEvent[] => {
	const events: ArchiveEvent[] = []

	for (const block of blocks) {
		let state = block.actionState.actionStateTwo
		for (const action of block.actionData) {
			const afterState = nextState(state, action.data)
			events.push({
				action: action.data,
				beforeActionState: state,
				afterActionState: afterState,
				timestamp: block.blockInfo.timestamp,
				hash: action.transactionInfo.hash,
				blockInfo: block.blockInfo
			})
			state = afterState
		}
	}

	return events
}

const loadRuntime = async ({
	exists = true,
	onSpawn
}: {
	exists?: boolean
	onSpawn?: (process: MockChildProcess, stdin: string) => void
} = {}) => {
	vi.resetModules()
	vi.doMock("@zeko-labs/bridge-sdk", () => ({
		Actions: {
			pushHash: (state: FakeField, hash: string) => new FakeField(`${state.toString()}|${hash}`)
		},
		fromList: (items: FakeField[][]) => ({
			hash: items
				.flat()
				.map((item) => item.toString())
				.join(",")
		})
	}))
	vi.doMock("o1js", () => ({
		Field: {
			from: (value: string | number) => new FakeField(String(value))
		}
	}))
	vi.doMock("node:fs", () => ({
		existsSync: () => exists
	}))
	vi.doMock("node:child_process", () => ({
		spawn: () => {
			const process = new EventEmitter() as MockChildProcess
			process.stdout = new EventEmitter()
			process.stderr = new EventEmitter()
			let stdin = ""
			process.stdin = {
				write: (chunk: string) => {
					stdin += chunk
				},
				end: () => {
					queueMicrotask(() => {
						onSpawn?.(process, stdin)
					})
				}
			}
			return process
		}
	}))
	return import("../src/action-processing/runtime")
}

afterEach(() => {
	vi.doUnmock("@zeko-labs/bridge-sdk")
	vi.doUnmock("o1js")
	vi.doUnmock("node:child_process")
	vi.doUnmock("node:fs")
	vi.restoreAllMocks()
})

describe("action-processing runtime", () => {
	it("uses main strategy when worker path is disabled", async () => {
		const { runActionProcessing } = await loadRuntime()
		const result = await runActionProcessing({
			blocks: makeBlocks(),
			preferWorker: false
		})
		expect(result.stats.strategy).toBe("main")
		expect(result.events.length).toBe(4)
	})

	it("surfaces worker failure when process script is unavailable", async () => {
		const { runActionProcessing } = await loadRuntime({ exists: false })
		await expect(
			runActionProcessing({
				blocks: makeBlocks(),
				preferWorker: true
			})
		).rejects.toThrow("action-processing process file not found")
	})

	it("resolves worker results when the subprocess returns valid JSON", async () => {
		const blocks = makeBlocks()
		const { runActionProcessing } = await loadRuntime({
			onSpawn: (process) => {
				process.stdout.emit(
					"data",
					JSON.stringify({
						ok: true,
						result: {
							events: makeEvents(blocks),
							stats: {
								strategy: "worker",
								totalMs: 12,
								hashingMs: 8,
								validationMs: 4,
								blocks: blocks.length,
								events: 4,
								bottleneck: "hashing"
							}
						}
					})
				)
				process.emit("close", 0)
			}
		})

		const result = await runActionProcessing({
			blocks,
			preferWorker: true,
			workerThreads: 1
		})

		expect(result.stats.strategy).toBe("worker")
		expect(result.events.length).toBe(4)
	})

	it("rejects cleanly when the subprocess exits non-zero", async () => {
		const { runActionProcessing } = await loadRuntime({
			onSpawn: (process) => {
				process.stderr.emit("data", "worker exploded")
				process.emit("close", 1)
			}
		})

		await expect(
			runActionProcessing({
				blocks: makeBlocks(),
				preferWorker: true,
				workerThreads: 1
			})
		).rejects.toThrow("worker exploded")
	})

	it("rejects cleanly when the subprocess returns invalid JSON", async () => {
		const { runActionProcessing } = await loadRuntime({
			onSpawn: (process) => {
				process.stdout.emit("data", "not-json")
				process.emit("close", 0)
			}
		})

		await expect(
			runActionProcessing({
				blocks: makeBlocks(),
				preferWorker: true,
				workerThreads: 1
			})
		).rejects.toThrow()
	})
})
