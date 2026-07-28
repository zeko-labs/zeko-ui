import { provedResultQuery } from "@zeko-labs/graphql"
import { type BridgeRuntime, debug } from "./runtime"

const parseProvingResult = (
	key: string,
	result: string
): { proved?: unknown; executed?: string } => {
	try {
		return JSON.parse(result)
	} catch (error) {
		const reason = error instanceof Error ? `: ${error.message}` : ""
		throw new Error(`Invalid proving result JSON for key ${key}${reason}`)
	}
}

const poll = async <T>(
	runtime: BridgeRuntime,
	key: string,
	pollPeriod: number,
	resolve: (result: { proved?: unknown; executed?: string }) => T | undefined
): Promise<T> => {
	debug(runtime, "pollQuery", { key })

	let attempts = 0

	while (true) {
		if (
			typeof runtime.config.pollTimeout === "number" &&
			runtime.config.pollTimeout >= 0 &&
			attempts > runtime.config.pollTimeout / pollPeriod
		) {
			throw new Error("Failed to fetch proved forest")
		}

		await new Promise((resolve) => setTimeout(resolve, pollPeriod))
		attempts++
		debug(runtime, "pollQuery waiting", { key, attempts, pollPeriod })

		const resultResponse = await runtime.l2Client().query(provedResultQuery, { key })
		if (resultResponse.error) throw resultResponse.error
		const result = resultResponse.data?.provingResult ?? null

		if (!result) continue

		const resolved = resolve(parseProvingResult(key, result))
		if (resolved !== undefined) return resolved
	}
}

export const pollProvingResult = async (
	runtime: BridgeRuntime,
	key: string,
	pollPeriod = 5_000
): Promise<string> => {
	return await poll(runtime, key, pollPeriod, (result) => {
		if (result.proved) return undefined
		if (result.executed) return result.executed
		throw new Error(`Unsupported proving result payload for key ${key}`)
	})
}

export const pollProvedForest = async (
	runtime: BridgeRuntime,
	key: string,
	pollPeriod = 5_000
): Promise<unknown[]> =>
	await poll(runtime, key, pollPeriod, (result) => {
		if (result.executed) throw new Error(`Proof key ${key} was already executed`)
		if (result.proved === undefined) {
			throw new Error(`Unsupported proving result payload for key ${key}`)
		}
		if (!Array.isArray(result.proved)) throw new Error(`Invalid proved forest for key ${key}`)
		return result.proved
	})
