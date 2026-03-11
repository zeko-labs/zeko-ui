import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockArchiveQuery = vi.hoisted(() => vi.fn())

vi.mock("@zeko-labs/bridge-sdk", () => ({
	createGraphqlClient: (archiveUrl: string) => () => ({
		query: (query: unknown, variables: Record<string, unknown>) =>
			mockArchiveQuery({ archiveUrl, query, variables })
	})
}))

vi.mock("@zeko-labs/graphql/mina-archive", () => ({
	fetchActionsQuery: {},
	networkStateQuery: {}
}))

const healthPayload = {
	status: "healthy",
	indexer: {
		lastFetchedBlock: {
			outer: 100,
			inner: 200
		}
	}
}

describe("sync checks", () => {
	beforeEach(() => {
		mockArchiveQuery.mockReset()
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				status: 200,
				text: async () => JSON.stringify(healthPayload)
			}))
		)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("reports zero lag when the tip advanced but there are no pending actions", async () => {
		mockArchiveQuery.mockImplementation(
			async ({
				archiveUrl,
				variables
			}: { archiveUrl: string; variables: Record<string, unknown> }) => {
				if (!("pk" in variables)) {
					return {
						error: null,
						data: {
							networkState: {
								maxBlockHeight: {
									pendingMaxBlockHeight: archiveUrl.includes("l1") ? 110 : 250
								}
							}
						}
					}
				}

				return {
					error: null,
					data: {
						actions: []
					}
				}
			}
		)

		const { runSyncCheck } = await import("../src/cli/checks")
		const result = await runSyncCheck({
			baseUrl: "https://indexer.actions.zeko.io",
			timeoutMs: 1000,
			l1ArchiveUrl: "https://l1.example/graphql",
			l2ArchiveUrl: "https://l2.example/graphql",
			outerPk: "outer-pk",
			innerPk: "inner-pk"
		})

		expect(result.outer.tipDistance).toBe(10)
		expect(result.outer.lag).toBe(0)
		expect(result.outer.hasPendingActions).toBe(false)
		expect(result.outer.status).toBe("ok")

		expect(result.inner.tipDistance).toBe(50)
		expect(result.inner.lag).toBe(0)
		expect(result.inner.hasPendingActions).toBe(false)
		expect(result.inner.status).toBe("ok")
	})

	it("reports lag only when there are pending actions after the indexed head", async () => {
		mockArchiveQuery.mockImplementation(
			async ({
				archiveUrl,
				variables
			}: { archiveUrl: string; variables: Record<string, unknown> }) => {
				if (!("pk" in variables)) {
					return {
						error: null,
						data: {
							networkState: {
								maxBlockHeight: {
									pendingMaxBlockHeight: archiveUrl.includes("l1") ? 110 : 250
								}
							}
						}
					}
				}

				return {
					error: null,
					data: {
						actions: archiveUrl.includes("l2") ? [{ id: "pending-action" }] : []
					}
				}
			}
		)

		const { runSyncCheck } = await import("../src/cli/checks")
		const result = await runSyncCheck({
			baseUrl: "https://indexer.actions.zeko.io",
			timeoutMs: 1000,
			l1ArchiveUrl: "https://l1.example/graphql",
			l2ArchiveUrl: "https://l2.example/graphql",
			outerPk: "outer-pk",
			innerPk: "inner-pk"
		})

		expect(result.outer.tipDistance).toBe(10)
		expect(result.outer.lag).toBe(0)
		expect(result.outer.status).toBe("ok")

		expect(result.inner.tipDistance).toBe(50)
		expect(result.inner.lag).toBe(50)
		expect(result.inner.hasPendingActions).toBe(true)
		expect(result.inner.status).toBe("behind")
	})
})
