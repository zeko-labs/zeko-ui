import { describe, expect, it } from "vitest"
import { indexerStatusFields } from "../src/cli/status"

describe("indexer CLI status projection", () => {
	it("exposes the independent registry cursor for every lifecycle output", () => {
		const status = {
			isRunning: true,
			lastRunTimestamp: 123,
			lastFetchedBlock: { outer: 10, inner: 20, registry: 30 },
			config: { intervalSeconds: 15 },
			consecutiveErrors: 0
		}

		expect(indexerStatusFields(status)).toMatchObject({
			lastFetchedOuter: 10,
			lastFetchedInner: 20,
			lastFetchedRegistry: 30
		})
	})
})
