import { describe, expect, it } from "vitest"
import {
	actionGapState,
	blockGap,
	buildChainInsight,
	finalityState,
	gapLabel,
	gapState,
	tailState
} from "../app/utils/ops-insights"
import {
	createOpsSnapshot,
	extractActionsIndexerDetails,
	getOpsConfig,
	normalizeEndpoint,
	probeActionsIndexer,
	readActionsIndexerToken,
	resolveOpsNetwork,
	runIndexerControl,
	summarizeActionCoverage,
	summarizeServices,
	type ServiceProbe
} from "../server/utils/ops"

const probe = (status: ServiceProbe["status"]): ServiceProbe => ({
	id: status,
	label: status,
	kind: "archive",
	status,
	endpoint: "https://example.test/graphql",
	checkedAt: "2026-06-10T00:00:00.000Z",
	latencyMs: 1,
	httpStatus: 200,
	details: {}
})

describe("ops dashboard utilities", () => {
	it("summarizes service states without mutating probe records", () => {
		const services = [probe("ok"), probe("warn"), probe("error"), probe("unknown"), probe("ok")]

		expect(summarizeServices(services)).toEqual({
			ok: 2,
			warn: 1,
			error: 1,
			unknown: 1
		})
		expect(services.map((service) => service.status)).toEqual([
			"ok",
			"warn",
			"error",
			"unknown",
			"ok"
		])
	})

	it("normalizes endpoint URLs for stable route composition", () => {
		expect(normalizeEndpoint("https://indexer.actions.zeko.io///")).toBe(
			"https://indexer.actions.zeko.io"
		)
	})

	it("resolves supported networks and falls back to mainnet", () => {
		expect(resolveOpsNetwork("testnet")).toBe("testnet")
		expect(resolveOpsNetwork("mainnet")).toBe("mainnet")
		expect(resolveOpsNetwork("unexpected")).toBe("mainnet")
		expect(resolveOpsNetwork(undefined)).toBe("mainnet")
	})

	it("uses network-specific endpoint defaults", () => {
		expect(getOpsConfig("mainnet")).toMatchObject({
			network: "mainnet",
			actionsIndexerUrl: "https://indexer.actions.zeko.io",
			l2DaemonUrl: "https://mainnet.zeko.io/graphql",
			outerActionsPublicKey: "B62qipwmBKAhWoDr19ydyM3jr2Cwr6rVnrWYUUfLam8oCWedPSem4aC",
			innerActionsPublicKey: "B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1"
		})
		expect(getOpsConfig("testnet")).toMatchObject({
			network: "testnet",
			actionsIndexerUrl: "https://testnet.indexer.actions.zeko.io",
			l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
			l1DaemonUrl: "https://gateway.mina.devnet.zeko.io",
			l2DaemonUrl: "https://testnet.zeko.io/graphql",
			outerActionsPublicKey: "B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2",
			innerActionsPublicKey: "B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1"
		})
	})

	it("prefers request-scoped Cloudflare env bindings over process env", () => {
		expect(
			getOpsConfig("testnet", {
				TESTNET_ACTIONS_INDEXER_URL: "https://private.testnet-indexer.example",
				TESTNET_L1_ARCHIVE_URL: "https://private.l1-archive.example/graphql",
				TESTNET_L2_ARCHIVE_URL: "https://private.l2-archive.example/graphql",
				TESTNET_L1_DAEMON_URL: "https://private.l1-daemon.example/graphql",
				TESTNET_L2_DAEMON_URL: "https://private.l2-daemon.example/graphql",
				TESTNET_OUTER_ACTIONS_PUBLIC_KEY: "testnet-outer",
				TESTNET_INNER_ACTIONS_PUBLIC_KEY: "testnet-inner"
			})
		).toMatchObject({
			actionsIndexerUrl: "https://private.testnet-indexer.example",
			l1ArchiveUrl: "https://private.l1-archive.example/graphql",
			l2ArchiveUrl: "https://private.l2-archive.example/graphql",
			l1DaemonUrl: "https://private.l1-daemon.example/graphql",
			l2DaemonUrl: "https://private.l2-daemon.example/graphql",
			outerActionsPublicKey: "testnet-outer",
			innerActionsPublicKey: "testnet-inner"
		})
	})

	it("reads network-specific indexer tokens from request-scoped env bindings", () => {
		expect(
			readActionsIndexerToken("testnet", {
				ACTIONS_INDEXER_TOKEN: "global-token",
				TESTNET_ACTIONS_INDEXER_TOKEN: "testnet-token"
			})
		).toBe("testnet-token")
		expect(
			readActionsIndexerToken("mainnet", {
				ACTIONS_INDEXER_TOKEN: "global-token"
			})
		).toBe("global-token")
	})

	it("uses request-scoped indexer token for status probes and controls", async () => {
		const originalFetch = globalThis.fetch
		const calls: Array<{
			url: string
			authorization: string | null
			forwardedProto: string | null
			method: string
			redirect: RequestRedirect | undefined
		}> = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input)
			const headers = new Headers(init?.headers)
			calls.push({
				url,
				authorization: headers.get("authorization"),
				forwardedProto: headers.get("x-forwarded-proto"),
				method: init?.method ?? "GET",
				redirect: init?.redirect
			})
			if (url.endsWith("/health")) {
				return Response.json({
					status: "healthy",
					service: { environment: "testnet" },
					database: { status: "up" },
					indexer: {
						status: "running",
						lastFetchedBlock: { outer: 10, inner: 20 },
						consecutiveErrors: 0,
						canonicalProgress: {}
					}
				})
			}
			if (url.endsWith("/status")) {
				return Response.json({ isRunning: true })
			}
			if (url.endsWith("/reset")) {
				return Response.json({ success: true })
			}
			return Response.json({
				data: {
					networkState: {
						maxBlockHeight: {
							canonicalMaxBlockHeight: 20,
							pendingMaxBlockHeight: 20
						}
					},
					syncStatus: "SYNCED"
				}
			})
		}) as typeof fetch

		try {
			await createOpsSnapshot("testnet", {
				TESTNET_ACTIONS_INDEXER_TOKEN: "testnet-token"
			})
			await runIndexerControl("reset", "testnet", {
				TESTNET_ACTIONS_INDEXER_TOKEN: "testnet-token"
			})
		} finally {
			globalThis.fetch = originalFetch
		}

		expect(calls.filter((call) => call.url.includes("testnet.indexer.actions.zeko.io"))).toEqual([
			expect.objectContaining({
				url: "https://testnet.indexer.actions.zeko.io/health",
				authorization: "Bearer testnet-token",
				forwardedProto: "https",
				method: "GET",
				redirect: "follow"
			}),
			expect.objectContaining({
				url: "https://testnet.indexer.actions.zeko.io/status",
				authorization: "Bearer testnet-token",
				forwardedProto: "https",
				method: "GET",
				redirect: "follow"
			}),
			expect.objectContaining({
				url: "https://testnet.indexer.actions.zeko.io/reset",
				authorization: "Bearer testnet-token",
				forwardedProto: "https",
				method: "POST",
				redirect: "follow"
			})
		])
	})

	it("reports explicit indexer probe errors when fetch fails without an Error object", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () => {
			throw null
		}) as typeof fetch

		try {
			await expect(
				probeActionsIndexer({
					endpoint: "https://testnet.indexer.actions.zeko.io",
					token: "testnet-token"
				})
			).resolves.toMatchObject({
				status: "error",
				error: "Unknown error probing Zeko action-indexer"
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("summarizes archive action coverage after the indexed head", () => {
		expect(
			summarizeActionCoverage({
				archiveHeight: 1_100,
				lastFetchedBlock: 1_000,
				actionBlocks: [],
				scanComplete: true
			})
		).toMatchObject({
			actionCoverageStatus: "current",
			missingActionCount: 0,
			missingActionBlockCount: 0,
			latestArchiveActionBlock: 1_000
		})
		expect(
			summarizeActionCoverage({
				archiveHeight: 1_100,
				lastFetchedBlock: 1_000,
				actionBlocks: [
					{ height: 1_020, actionCount: 2 },
					{ height: 1_050, actionCount: 1 }
				],
				scanComplete: true
			})
		).toMatchObject({
			actionCoverageStatus: "missing",
			missingActionCount: 3,
			missingActionBlockCount: 2,
			firstMissingActionBlock: 1_020,
			latestArchiveActionBlock: 1_050
		})
	})

	it("flattens actions indexer database and canonical progress details", () => {
		expect(
			extractActionsIndexerDetails({
				healthPayload: {
					status: "healthy",
					service: { environment: "testnet" },
					database: {
						status: "up",
						latency_ms: 14,
						checkedAt: "2026-06-10T12:35:08.177Z",
						ageMs: 5
					},
					indexer: {
						status: "running",
						lastFetchedBlock: { outer: 526_766, inner: 1_094_790 },
						consecutiveErrors: 0,
						canonicalProgress: {
							checkedAt: "2026-06-10T12:34:58.207Z",
							ageMs: 9975,
							outer: {
								lastFinalIndex: 74_502,
								lastFinalBlockHeight: 526_476,
								nonCanonicalTailCount: 280
							},
							inner: {
								lastFinalIndex: 10_554,
								lastFinalBlockHeight: 1_080_812,
								nonCanonicalTailCount: 2
							}
						}
					}
				},
				statusPayload: {
					isRunning: true,
					config: { intervalSeconds: 30 },
					canonicalProgress: {
						outer: { nonCanonicalTailCount: 281 }
					}
				}
			})
		).toMatchObject({
			health: "healthy",
			environment: "testnet",
			databaseStatus: "up",
			databaseLatencyMs: 14,
			databaseCheckedAt: "2026-06-10T12:35:08.177Z",
			databaseAgeMs: 5,
			indexer: "running",
			running: true,
			intervalSeconds: 30,
			lastFetchedOuter: 526_766,
			lastFetchedInner: 1_094_790,
			canonicalAgeMs: 9975,
			outerLastFinalIndex: 74_502,
			outerLastFinalBlockHeight: 526_476,
			outerNonCanonicalTailCount: 281,
			innerLastFinalIndex: 10_554,
			innerLastFinalBlockHeight: 1_080_812,
			innerNonCanonicalTailCount: 2
		})
	})

	it("calculates signed archive/indexer and daemon/archive gaps", () => {
		expect(blockGap(1_050, 1_000)).toBe(50)
		expect(blockGap(1_000, 1_050)).toBe(-50)
		expect(gapLabel(50, "ahead", "behind")).toBe("50 behind")
		expect(gapLabel(-50, "ahead", "behind")).toBe("50 ahead")
		expect(gapState(4)).toBe("ok")
		expect(gapState(50)).toBe("warn")
		expect(gapState(500)).toBe("error")
		expect(gapState(null)).toBe("unknown")
		expect(finalityState(290, 290)).toBe("ok")
		expect(finalityState(291, 290)).toBe("warn")
		expect(actionGapState(1_000)).toBe("warn")
		expect(actionGapState(0)).toBe("ok")
		expect(tailState(280, 290)).toBe("ok")
	})

	it("builds L1 chain insights from action-indexer, archive, and daemon probes", () => {
		expect(
			buildChainInsight({
				id: "l1",
				label: "L1 Mina",
				indexerLabel: "Outer",
				indexer: {
					id: "actions-indexer",
					details: {
						lastFetchedOuter: 990,
						outerLastFinalBlockHeight: 980,
						outerNonCanonicalTailCount: 10
					}
				},
				archive: {
					id: "l1-archive",
					details: {
						canonicalMaxBlockHeight: 995,
						pendingMaxBlockHeight: 1_000
					}
				},
				daemon: {
					id: "l1-daemon",
					details: { blockHeight: 1_002 }
				},
				indexerHeightKey: "lastFetchedOuter",
				indexerFinalHeightKey: "outerLastFinalBlockHeight",
				nonCanonicalTailKey: "outerNonCanonicalTailCount",
				expectedFinalityBlocks: 290,
				daemonBlockHeightSupported: true
			})
		).toMatchObject({
			lastActionBlockHeight: 990,
			finalActionBlockHeight: 980,
			nonCanonicalTailCount: 10,
			archiveHeight: 1_000,
			archiveCanonicalHeight: 995,
			daemonHeight: 1_002,
			archiveFinalityGap: 5,
			canonicalActionGap: 15,
			lastActionGap: 10,
			archiveDaemonGap: 2
		})
	})

	it("does not invent an L2 daemon block height", () => {
		expect(
			buildChainInsight({
				id: "l2",
				label: "L2 Zeko",
				indexerLabel: "Inner",
				indexer: {
					id: "actions-indexer",
					details: {
						lastFetchedInner: 1_000,
						innerLastFinalBlockHeight: 990,
						innerNonCanonicalTailCount: 2
					}
				},
				archive: {
					id: "l2-archive",
					details: {
						canonicalMaxBlockHeight: 1_010,
						pendingMaxBlockHeight: 1_010
					}
				},
				daemon: {
					id: "l2-daemon",
					details: { blockHeight: 1_010 }
				},
				indexerHeightKey: "lastFetchedInner",
				indexerFinalHeightKey: "innerLastFinalBlockHeight",
				nonCanonicalTailKey: "innerNonCanonicalTailCount",
				expectedFinalityBlocks: null,
				daemonBlockHeightSupported: false
			})
		).toMatchObject({
			daemonHeight: null,
			archiveDaemonGap: null
		})
	})
})
