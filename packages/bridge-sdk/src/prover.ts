import { provedResultQuery } from "@zeko-labs/graphql"
import { debug, type BridgeRuntime } from "./runtime"

export const pollProvingResult = async (
	runtime: BridgeRuntime,
	key: string,
	pollPeriod = 5_000
): Promise<string> => {
	debug(runtime, "pollQuery", { key })

	let result: string | null = null
	let attempts = 0

	while (!result) {
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
		result = resultResponse.data?.provingResult ?? null

		if (!result) continue

		const resultObject: { proved?: unknown; executed?: string } = JSON.parse(result)

		if (resultObject.proved) {
			result = null
		} else if (resultObject.executed) {
			return resultObject.executed
		}
	}
	throw new Error("Should not be reachable")
}
