import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { indexerControlCopy } from "../app/utils/indexer-control-copy"
import { postControlRefreshOptions } from "../app/utils/refresh-options"
import {
	actionGapState,
	actionFinalityDetail,
	actionFinalityLabel,
	actionFinalityState,
	blockGap,
	buildChainInsight,
	databaseAgeSeconds,
	finalityState,
	gapLabel,
	gapState,
	tailState
} from "../app/utils/ops-insights"
import {
	createActionCoverageSnapshot,
	createOpsSnapshot,
	extractActionsIndexerDetails,
	getActionsIndexerRequestUrl,
	getOpsConfig,
	indexerControlTimeoutMs,
	isControlRequestAllowed,
	normalizeEndpoint,
	probeDaemon,
	probeActionsIndexer,
	probeActionsApi,
	readActionsIndexerToken,
	resolveControlRequestOrigin,
	resolveControlNetwork,
	resolveOpsNetwork,
	resolveRouteEnv,
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

describe("actions dashboard utilities", () => {
	it("rejects cross-site or form-encoded control requests", () => {
		expect(
			isControlRequestAllowed({
				contentType: "application/json",
				origin: "https://actions.dashboard.zeko.io",
				requestOrigin: "https://actions.dashboard.zeko.io",
				secFetchSite: "same-origin"
			})
		).toBe(true)

		expect(
			isControlRequestAllowed({
				contentType: "application/x-www-form-urlencoded",
				origin: "https://evil.example",
				requestOrigin: "https://actions.dashboard.zeko.io",
				secFetchSite: "cross-site"
			})
		).toBe(false)
		expect(
			isControlRequestAllowed({
				contentType: "application/json",
				origin: "https://evil.example",
				requestOrigin: "https://actions.dashboard.zeko.io",
				secFetchSite: "cross-site"
			})
		).toBe(false)
	})

	it("preserves localhost HTTP origins for local control requests", () => {
		expect(
			resolveControlRequestOrigin({
				host: "localhost:3092",
				origin: "http://localhost:3092"
			})
		).toBe("http://localhost:3092")

		expect(
			resolveControlRequestOrigin({
				host: "localhost:3092",
				"x-forwarded-host": "actions.dashboard.zeko.io",
				"x-forwarded-proto": "https"
			})
		).toBe("https://actions.dashboard.zeko.io")
	})

	it("forces the dashboard refresh after control actions", () => {
		expect(postControlRefreshOptions).toEqual({ force: true })
	})

	it("does not enable public Worker hostnames for control routes", () => {
		const wranglerConfig = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")

		expect(wranglerConfig).toContain('"workers_dev": false')
		expect(wranglerConfig).not.toContain('"preview_urls": true')
		expect(wranglerConfig).toContain('"global_fetch_strictly_public"')
		expect(wranglerConfig).not.toContain("_ORIGIN_")
	})

	it("uses canonical actions-indexer control names and explains rebuild versus reset", () => {
		expect(indexerControlCopy.reset.label).toBe("Reset")
		expect(indexerControlCopy.note).toContain("Rebuild")
		expect(indexerControlCopy.note).toContain("Reset")
		expect(indexerControlCopy.note).toContain("indexed rows")
		expect(indexerControlCopy.note).toContain("starts from scratch")
		expect(indexerControlCopy.rebuild.whenToUse).toContain("archive data is trusted")
		expect(indexerControlCopy.reset.whenToUse).toContain("cannot be trusted")
	})

	it("does not expose an indexer token API endpoint to the browser", () => {
		expect(existsSync(new URL("../server/api/ops/indexer-token.get.ts", import.meta.url))).toBe(
			false
		)
	})

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

	it("resolves every dashboard request to Sepolia", () => {
		expect(resolveOpsNetwork("sepolia")).toBe("sepolia")
		expect(resolveOpsNetwork("unexpected")).toBe("sepolia")
		expect(resolveOpsNetwork(undefined)).toBe("sepolia")
	})

	it("requires Sepolia for control requests", () => {
		expect(resolveControlNetwork("sepolia")).toBe("sepolia")
		expect(() => resolveControlNetwork(undefined)).toThrow("Unsupported network")
		expect(() => resolveControlNetwork("other")).toThrow("Unsupported network")
	})

	it("reads database status age from database health details", () => {
		expect(
			databaseAgeSeconds({
				id: "actions-indexer",
				details: {
					databaseAgeMs: 5_000,
					canonicalAgeMs: 90_000
				}
			})
		).toBe(5)
	})

	it("uses network-specific endpoint defaults", () => {
		expect(getOpsConfig("sepolia")).toMatchObject({
			network: "sepolia",
			actionsIndexerUrl: "https://sepolia.indexer.actions.zeko.io",
			actionsApiUrl: "https://sepolia.api.actions.zeko.io/graphql",
			l1ArchiveUrl: "https://sepolia-gateway.zeko.io/graphql",
			l2ArchiveUrl: "https://archive.sepolia.zeko.io/graphql",
			l1DaemonUrl: null,
			l2DaemonUrl: "https://sepolia.zeko.io/graphql",
			outerActionsPublicKey: "B62qpggUSofPZcWqtgbmLVnSAzzjAqSXjyckLJaBeGmXiPnc2mGUfhf",
			innerActionsPublicKey: "B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1"
		})
		expect(getActionsIndexerRequestUrl("sepolia")).toBe("https://sepolia.indexer.actions.zeko.io")
	})

	it("prefers Sepolia request-scoped environment bindings", () => {
		expect(
			getOpsConfig("sepolia", {
				SEPOLIA_ACTIONS_INDEXER_URL: "https://private.sepolia-indexer.example",
				SEPOLIA_L1_ARCHIVE_URL: "https://private.l1-archive.example/graphql",
				SEPOLIA_L2_ARCHIVE_URL: "https://private.l2-archive.example/graphql",
				SEPOLIA_L1_DAEMON_URL: "https://private.l1-daemon.example/graphql",
				SEPOLIA_L2_DAEMON_URL: "https://private.l2-daemon.example/graphql",
				SEPOLIA_OUTER_ACTIONS_PUBLIC_KEY: "sepolia-outer",
				SEPOLIA_INNER_ACTIONS_PUBLIC_KEY: "sepolia-inner"
			})
		).toMatchObject({
			actionsIndexerUrl: "https://private.sepolia-indexer.example",
			l1ArchiveUrl: "https://private.l1-archive.example/graphql",
			l2ArchiveUrl: "https://private.l2-archive.example/graphql",
			l1DaemonUrl: "https://private.l1-daemon.example/graphql",
			l2DaemonUrl: "https://private.l2-daemon.example/graphql",
			outerActionsPublicKey: "sepolia-outer",
			innerActionsPublicKey: "sepolia-inner"
		})
	})

	it("merges request-scoped environment over local environment", () => {
		const original = process.env.SEPOLIA_ACTIONS_INDEXER_TOKEN
		process.env.SEPOLIA_ACTIONS_INDEXER_TOKEN = "local-token"

		try {
			expect(
				resolveRouteEnv({
					SEPOLIA_ACTIONS_INDEXER_TOKEN: "cloudflare-token"
				}).SEPOLIA_ACTIONS_INDEXER_TOKEN
			).toBe("cloudflare-token")
			expect(resolveRouteEnv().SEPOLIA_ACTIONS_INDEXER_TOKEN).toBe("local-token")
		} finally {
			if (original === undefined) delete process.env.SEPOLIA_ACTIONS_INDEXER_TOKEN
			else process.env.SEPOLIA_ACTIONS_INDEXER_TOKEN = original
		}
	})

	it("reads the Sepolia indexer token from request-scoped env bindings", () => {
		expect(
			readActionsIndexerToken("sepolia", {
				SEPOLIA_ACTIONS_INDEXER_TOKEN: "sepolia-token"
			})
		).toBe("sepolia-token")
		expect(readActionsIndexerToken("sepolia", {})).toBeUndefined()
	})

	it("reports the unsupported Sepolia L1 daemon explicitly", async () => {
		const result = await probeDaemon({
			id: "l1-daemon",
			label: "L1 daemon",
			endpoint: null,
			supportsBestChain: true
		})

		expect(result.status).toBe("unknown")
		expect(result.endpoint).toBe("not configured")
		expect(result.error).toContain("No Sepolia L1 daemon endpoint is configured")
	})

	it("uses request-scoped indexer token for status probes and controls", async () => {
		const originalFetch = globalThis.fetch
		const calls: Array<{
			url: string
			authorization: string | null
			forwarded: string | null
			forwardedHost: string | null
			forwardedPort: string | null
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
				forwarded: headers.get("forwarded"),
				forwardedHost: headers.get("x-forwarded-host"),
				forwardedPort: headers.get("x-forwarded-port"),
				forwardedProto: headers.get("x-forwarded-proto"),
				method: init?.method ?? "GET",
				redirect: init?.redirect
			})
			if (url.endsWith("/health")) {
				return Response.json({
					status: "healthy",
					service: { environment: "sepolia" },
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
			await createOpsSnapshot("sepolia", {
				SEPOLIA_ACTIONS_INDEXER_TOKEN: "sepolia-token"
			})
			await runIndexerControl("reset", "sepolia", {
				SEPOLIA_ACTIONS_INDEXER_TOKEN: "sepolia-token"
			})
		} finally {
			globalThis.fetch = originalFetch
		}

		expect(calls.filter((call) => call.url.includes("sepolia.indexer.actions.zeko.io"))).toEqual([
			expect.objectContaining({
				url: "https://sepolia.indexer.actions.zeko.io/health",
				authorization: null,
				forwarded: null,
				forwardedHost: null,
				forwardedPort: null,
				forwardedProto: null,
				method: "GET",
				redirect: "follow"
			}),
			expect.objectContaining({
				url: "https://sepolia.indexer.actions.zeko.io/status",
				authorization: "Bearer sepolia-token",
				forwarded: null,
				forwardedHost: null,
				forwardedPort: null,
				forwardedProto: null,
				method: "GET",
				redirect: "follow"
			}),
			expect.objectContaining({
				url: "https://sepolia.indexer.actions.zeko.io/reset",
				authorization: "Bearer sepolia-token",
				forwarded: null,
				forwardedHost: null,
				forwardedPort: null,
				forwardedProto: null,
				method: "POST",
				redirect: "follow"
			})
		])
	})

	it("selects scalar daemonStatus fields in daemon health probes", async () => {
		const originalFetch = globalThis.fetch
		const queries: string[] = []
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }
			queries.push(body.query ?? "")
			if (body.query?.includes("OpsDaemonState")) {
				return Response.json({
					data: {
						syncStatus: "SYNCED",
						daemonStatus: { syncStatus: "SYNCED", chainId: "zeko-sepolia" }
					}
				})
			}
			return Response.json({
				data: {
					bestChain: [
						{
							stateHash: "state",
							protocolState: {
								consensusState: {
									blockHeight: 10,
									slotSinceGenesis: 20
								}
							}
						}
					]
				}
			})
		}) as typeof fetch

		try {
			await probeDaemon({
				id: "l1-daemon",
				label: "L1 daemon",
				endpoint: "https://daemon.example/graphql",
				supportsBestChain: true
			})
		} finally {
			globalThis.fetch = originalFetch
		}

		expect(queries[0]).toMatch(/daemonStatus\s*\{[^}]*chainId/s)
	})

	it("reports explicit indexer probe errors when fetch fails without an Error object", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () => {
			throw null
		}) as typeof fetch

		try {
			await expect(
				probeActionsIndexer({
					endpoint: "https://sepolia.indexer.actions.zeko.io",
					token: "sepolia-token"
				})
			).resolves.toMatchObject({
				status: "error",
				error: "Unknown error probing Zeko action-indexer"
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("does not report the indexer as ok when authenticated status fails", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input)
			if (url.endsWith("/health")) {
				return Response.json({
					status: "healthy",
					service: { environment: "sepolia" },
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
				return Response.json({ message: "invalid token" }, { status: 401 })
			}
			return Response.json({})
		}) as typeof fetch

		try {
			await expect(
				probeActionsIndexer({
					endpoint: "https://sepolia.indexer.actions.zeko.io",
					token: "bad-token"
				})
			).resolves.toMatchObject({
				status: "warn",
				httpStatus: 200,
				details: { statusHttp: 401 },
				error: 'Status check returned HTTP 401: {"message":"invalid token"}'
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("warns when the actions indexer is reachable but outer finality is behind", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input)
			if (url.endsWith("/health")) {
				return Response.json({
					status: "healthy",
					service: { environment: "sepolia" },
					database: { status: "up" },
					indexer: {
						status: "running",
						lastFetchedBlock: { outer: 529_014, inner: 1_097_571 },
						consecutiveErrors: 0,
						canonicalProgress: {
							checkedAt: "2026-06-18T16:36:00.000Z",
							ageMs: 15_000,
							outer: {
								lastFinalIndex: 75_728,
								lastFinalBlockHeight: 528_722,
								nonCanonicalTailCount: 124
							},
							inner: {
								lastFinalIndex: 10_763,
								lastFinalBlockHeight: 1_097_571,
								nonCanonicalTailCount: 0
							}
						}
					}
				})
			}
			if (url.endsWith("/status")) return Response.json({ isRunning: true })
			return Response.json({})
		}) as typeof fetch

		try {
			await expect(
				probeActionsIndexer({
					endpoint: "https://sepolia.indexer.actions.zeko.io",
					token: "sepolia-token"
				})
			).resolves.toMatchObject({
				status: "warn",
				details: {
					outerLastFinalIndex: 75_728,
					outerLastFinalBlockHeight: 528_722,
					lastFetchedOuter: 529_014,
					outerNonCanonicalTailCount: 124,
					outerFinalityLagBlocks: 292
				},
				error:
					"Bridge finality degraded: 124 outer actions are not final; final outer block 528,722, fetched outer block 529,014."
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("warns when the deployed actions API schema does not expose finality metadata", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async () =>
			Response.json({
				data: {
					outerAction: {
						fields: [{ name: "afterState" }, { name: "beforeState" }, { name: "index" }]
					},
					innerAction: {
						fields: [{ name: "afterState" }, { name: "beforeState" }, { name: "index" }]
					}
				}
			})) as typeof fetch

		try {
			await expect(
				probeActionsApi({
					endpoint: "https://sepolia.api.actions.zeko.io/graphql"
				})
			).resolves.toMatchObject({
				id: "actions-api",
				status: "warn",
				details: {
					outerActionFinalityMetadata: false,
					innerActionFinalityMetadata: false
				},
				error: "Actions API schema is missing finality metadata"
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("warns when the actions API final commit is behind the pending outer tail", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }
			if (body.query?.includes("OpsActionsApiSchema")) {
				return Response.json({
					data: {
						outerAction: {
							fields: [
								{ name: "index" },
								{ name: "finalityStatus" },
								{ name: "markedAsCanonicalAt" }
							]
						},
						innerAction: {
							fields: [
								{ name: "index" },
								{ name: "finalityStatus" },
								{ name: "markedAsCanonicalAt" }
							]
						}
					}
				})
			}
			if (body.query?.includes("OpsActionsApiFinality")) {
				return Response.json({
					data: {
						commitAsePastSlot: {
							commit: {
								index: 75_763,
								blockHeight: 528_733,
								timestamp: "2026-06-17T21:18:00.000Z",
								innerActionStateLength: 10_606,
								synchronizedOuterActionStateLength: 75_760,
								markedAsCanonicalAt: "2026-06-18T22:09:33.738Z"
							},
							ase: [
								{
									index: 75_764,
									blockHeight: 528_734,
									timestamp: "2026-06-17T21:27:00.000Z",
									kind: "COMMIT",
									markedAsCanonicalAt: null,
									innerActionStateLength: 10_606,
									synchronizedOuterActionStateLength: 75_760
								},
								{
									index: 75_887,
									blockHeight: 529_023,
									timestamp: "2026-06-18T22:09:00.000Z",
									kind: "COMMIT",
									markedAsCanonicalAt: null,
									innerActionStateLength: 10_608,
									synchronizedOuterActionStateLength: 75_885
								}
							]
						}
					}
				})
			}
			return Response.json({})
		}) as typeof fetch

		try {
			await expect(
				probeActionsApi({
					endpoint: "https://sepolia.api.actions.zeko.io/graphql"
				})
			).resolves.toMatchObject({
				id: "actions-api",
				status: "warn",
				details: {
					finalOuterCommitIndex: 75_763,
					finalOuterCommitBlockHeight: 528_733,
					finalOuterCommitTimestamp: "2026-06-17T21:18:00.000Z",
					finalOuterCommitMarkedAsCanonicalAt: "2026-06-18T22:09:33.738Z",
					pendingOuterTailCount: 2,
					pendingOuterFirstIndex: 75_764,
					pendingOuterLastIndex: 75_887,
					pendingOuterLastBlockHeight: 529_023,
					pendingOuterLastTimestamp: "2026-06-18T22:09:00.000Z"
				},
				error:
					"Actions API finality degraded: 2 pending outer actions after final commit 75,763 at block 528,733; latest pending outer action 75,887 at block 529,023."
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("warns when the actions API finality anchor is itself pending", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }
			if (body.query?.includes("OpsActionsApiSchema")) {
				return Response.json({
					data: {
						outerAction: {
							fields: [
								{ name: "index" },
								{ name: "finalityStatus" },
								{ name: "markedAsCanonicalAt" }
							]
						},
						innerAction: {
							fields: [
								{ name: "index" },
								{ name: "finalityStatus" },
								{ name: "markedAsCanonicalAt" }
							]
						}
					}
				})
			}
			if (body.query?.includes("OpsActionsApiFinality")) {
				return Response.json({
					data: {
						commitAsePastSlot: {
							commit: {
								index: 75_887,
								blockHeight: 529_023,
								timestamp: "2026-06-18T22:09:00.000Z",
								kind: "COMMIT",
								innerActionStateLength: 10_608,
								synchronizedOuterActionStateLength: 75_885,
								markedAsCanonicalAt: null
							},
							ase: []
						}
					}
				})
			}
			return Response.json({})
		}) as typeof fetch

		try {
			await expect(
				probeActionsApi({
					endpoint: "https://sepolia.api.actions.zeko.io/graphql"
				})
			).resolves.toMatchObject({
				id: "actions-api",
				status: "warn",
				details: {
					finalOuterCommitIndex: 75_887,
					finalOuterCommitBlockHeight: 529_023,
					finalOuterCommitMarkedAsCanonicalAt: null,
					pendingOuterTailCount: 1,
					pendingOuterFirstIndex: 75_887,
					pendingOuterLastIndex: 75_887,
					pendingOuterLastBlockHeight: 529_023,
					pendingOuterLastTimestamp: "2026-06-18T22:09:00.000Z"
				},
				error:
					"Actions API finality degraded: latest outer commit 75,887 at block 529,023 is pending and not marked canonical."
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("includes actions API compatibility warnings in the dashboard snapshot", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input)
			const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }

			if (url.endsWith("/health")) {
				return Response.json({
					status: "healthy",
					service: { environment: "sepolia" },
					database: { status: "up" },
					indexer: {
						status: "running",
						lastFetchedBlock: { outer: 10, inner: 20 },
						consecutiveErrors: 0,
						canonicalProgress: {}
					}
				})
			}

			if (url.endsWith("/status")) return Response.json({ isRunning: true })

			if (body.query?.includes("OpsActionsApiSchema")) {
				return Response.json({
					data: {
						outerAction: { fields: [{ name: "index" }] },
						innerAction: { fields: [{ name: "index" }] }
					}
				})
			}

			if (body.query?.includes("OpsActionCoverage")) {
				return Response.json({ data: { actions: [] } })
			}

			if (body.query?.includes("OpsArchiveState")) {
				return Response.json({
					data: {
						networkState: {
							maxBlockHeight: {
								canonicalMaxBlockHeight: 20,
								pendingMaxBlockHeight: 20
							}
						}
					}
				})
			}

			return Response.json({
				data: {
					syncStatus: "SYNCED",
					daemonStatus: { syncStatus: "SYNCED" },
					bestChain: [
						{
							stateHash: "state",
							protocolState: {
								consensusState: {
									blockHeight: 20,
									slotSinceGenesis: 30
								}
							}
						}
					]
				}
			})
		}) as typeof fetch

		try {
			await expect(
				createOpsSnapshot("sepolia", {
					SEPOLIA_ACTIONS_INDEXER_TOKEN: "sepolia-token"
				})
			).resolves.toMatchObject({
				summary: { warn: 1 },
				services: expect.arrayContaining([
					expect.objectContaining({
						id: "actions-api",
						status: "warn",
						error: "Actions API schema is missing finality metadata"
					})
				])
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("downgrades an L1 daemon when the best-chain head probe fails", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }
			if (body.query?.includes("OpsDaemonState")) {
				return Response.json({
					data: {
						syncStatus: "SYNCED",
						daemonStatus: {}
					}
				})
			}
			return Response.json({
				errors: [{ message: "bestChain unavailable" }]
			})
		}) as typeof fetch

		try {
			await expect(
				probeDaemon({
					id: "l1-daemon",
					label: "L1 daemon",
					endpoint: "https://daemon.example/graphql",
					supportsBestChain: true
				})
			).resolves.toMatchObject({
				status: "warn",
				details: {
					syncStatus: "SYNCED",
					blockHeight: null,
					chainHead: "bestChain unavailable"
				}
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("allows synchronous indexer rebuilds enough time to complete", () => {
		expect(indexerControlTimeoutMs).toBe(300_000)
	})

	it("does not retry non-idempotent indexer controls", async () => {
		const originalFetch = globalThis.fetch
		let controlCalls = 0
		globalThis.fetch = (async () => {
			controlCalls += 1
			return Response.json({ success: false, message: "busy" }, { status: 503 })
		}) as typeof fetch

		try {
			await expect(
				runIndexerControl("reset", "sepolia", {
					SEPOLIA_ACTIONS_INDEXER_TOKEN: "sepolia-token"
				})
			).rejects.toThrow("reset failed with HTTP 503")
		} finally {
			globalThis.fetch = originalFetch
		}

		expect(controlCalls).toBe(1)
	})

	it("defaults Cloudflare Access to account-member auth and updates paginated resources", async () => {
		const originalFetch = globalThis.fetch
		const originalEnv = {
			CFZT_TOKEN: process.env.CFZT_TOKEN,
			CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
			ACTIONS_DASHBOARD_ACCESS_PROVIDER: process.env.ACTIONS_DASHBOARD_ACCESS_PROVIDER,
			ACTIONS_DASHBOARD_GITHUB_ORG: process.env.ACTIONS_DASHBOARD_GITHUB_ORG
		}
		const calls: Array<{ method: string; path: string; page: string | null }> = []

		process.env.CFZT_TOKEN = "cf-token"
		process.env.CLOUDFLARE_ACCOUNT_ID = "account-id"
		delete process.env.ACTIONS_DASHBOARD_ACCESS_PROVIDER
		process.env.ACTIONS_DASHBOARD_GITHUB_ORG = "zeko-labs"

		const listEnvelope = <T>(result: T[], page: number, totalPages: number) =>
			Response.json({
				success: true,
				result,
				errors: [],
				result_info: {
					page,
					per_page: 100,
					count: result.length,
					total_count: totalPages,
					total_pages: totalPages
				}
			})

		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input))
			const path = url.pathname.split("/access/")[1]
			const method = init?.method ?? "GET"
			calls.push({ method, path, page: url.searchParams.get("page") })

			if (method === "GET" && path === "identity_providers")
				return url.searchParams.get("page") === "1"
					? listEnvelope([], 1, 2)
					: listEnvelope([{ id: "cloudflare-idp", name: "Cloudflare", type: "cloudflare" }], 2, 2)

			if (method === "PUT" && path === "identity_providers/cloudflare-idp")
				return Response.json({
					success: true,
					result: {
						id: "cloudflare-idp",
						name: "Cloudflare",
						type: "cloudflare"
					},
					errors: []
				})

			if (method === "GET" && path === "apps")
				return url.searchParams.get("page") === "1"
					? listEnvelope([], 1, 2)
					: listEnvelope(
							[
								{
									id: "app-id",
									name: "Zeko Actions Dashboard",
									domain: "actions.dashboard.zeko.io",
									type: "self_hosted"
								}
							],
							2,
							2
						)

			if (method === "GET" && path === "apps/app-id/policies")
				return url.searchParams.get("page") === "1"
					? listEnvelope([], 1, 2)
					: listEnvelope(
							[
								{
									id: "policy-id",
									name: "Allow Zeko Cloudflare account",
									decision: "allow",
									precedence: 1
								}
							],
							2,
							2
						)

			if (method === "PUT" && path === "apps/app-id")
				return Response.json({
					success: true,
					result: {
						id: "app-id",
						name: "Zeko Actions Dashboard",
						domain: "actions.dashboard.zeko.io",
						type: "self_hosted"
					},
					errors: []
				})

			if (method === "PUT" && path === "apps/app-id/policies/policy-id")
				return Response.json({
					success: true,
					result: {
						id: "policy-id",
						name: "Allow Zeko Cloudflare account",
						decision: "allow",
						precedence: 1
					},
					errors: []
				})

			return Response.json(
				{
					success: false,
					result: null,
					errors: [{ code: 1, message: `${method} ${path} was not expected` }]
				},
				{ status: 500 }
			)
		}) as typeof fetch

		try {
			await import("../scripts/configure-access")
		} finally {
			globalThis.fetch = originalFetch
			for (const [key, value] of Object.entries(originalEnv)) {
				if (value === undefined) delete process.env[key]
				else process.env[key] = value
			}
		}

		expect(calls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ method: "GET", path: "identity_providers", page: "2" }),
				expect.objectContaining({ method: "PUT", path: "identity_providers/cloudflare-idp" }),
				expect.objectContaining({ method: "GET", path: "apps", page: "2" }),
				expect.objectContaining({ method: "GET", path: "apps/app-id/policies", page: "2" }),
				expect.objectContaining({ method: "PUT", path: "apps/app-id" }),
				expect.objectContaining({ method: "PUT", path: "apps/app-id/policies/policy-id" })
			])
		)
		expect(calls.some((call) => call.method === "POST")).toBe(false)
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

	it("treats L2 archive head distance as current when no newer action rows exist", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input)
			const body = JSON.parse(String(init?.body ?? "{}")) as {
				query?: string
				variables?: Record<string, unknown>
			}

			if (body.query?.includes("OpsArchiveState")) {
				return Response.json({
					data: {
						networkState: {
							maxBlockHeight: {
								canonicalMaxBlockHeight: url.includes("l2") ? 1_095_396 : 526_837,
								pendingMaxBlockHeight: url.includes("l2") ? 1_095_396 : 526_837
							}
						}
					}
				})
			}

			if (body.query?.includes("OpsActionCoverage")) {
				return Response.json({
					data: {
						actions: body.variables?.pk === "inner-pk" ? [] : []
					}
				})
			}

			return Response.json({ data: {} })
		}) as typeof fetch

		try {
			await expect(
				createActionCoverageSnapshot(
					"sepolia",
					{
						lastFetchedOuter: 526_837,
						lastFetchedInner: 1_095_349
					},
					{
						SEPOLIA_L1_ARCHIVE_URL: "https://l1.example/graphql",
						SEPOLIA_L2_ARCHIVE_URL: "https://l2.example/graphql",
						SEPOLIA_OUTER_ACTIONS_PUBLIC_KEY: "outer-pk",
						SEPOLIA_INNER_ACTIONS_PUBLIC_KEY: "inner-pk"
					}
				)
			).resolves.toMatchObject({
				l2: {
					actionCoverageStatus: "current",
					missingActionCount: 0,
					missingActionBlockCount: 0,
					latestArchiveActionBlock: 1_095_349,
					actionScanFrom: 1_095_350,
					actionScanTo: 1_095_396
				}
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("ignores orphaned archive actions when probing missing dashboard coverage", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input)
			const body = JSON.parse(String(init?.body ?? "{}")) as {
				query?: string
				variables?: Record<string, unknown>
			}

			if (body.query?.includes("OpsArchiveState")) {
				return Response.json({
					data: {
						networkState: {
							maxBlockHeight: {
								canonicalMaxBlockHeight: url.includes("l2") ? 1_100 : 600,
								pendingMaxBlockHeight: url.includes("l2") ? 1_100 : 600
							}
						}
					}
				})
			}

			if (body.query?.includes("OpsActionCoverage")) {
				return Response.json({
					data: {
						actions:
							body.variables?.pk === "inner-pk"
								? [
										{
											blockInfo: { height: 1_020, chainStatus: "orphaned" },
											actionData: [{ data: ["orphaned"] }]
										},
										{
											blockInfo: { height: 1_050, chainStatus: "pending" },
											actionData: [{ data: ["pending"] }]
										}
									]
								: []
					}
				})
			}

			return Response.json({ data: {} })
		}) as typeof fetch

		try {
			await expect(
				createActionCoverageSnapshot(
					"sepolia",
					{
						lastFetchedOuter: 600,
						lastFetchedInner: 1_000
					},
					{
						SEPOLIA_L1_ARCHIVE_URL: "https://l1.example/graphql",
						SEPOLIA_L2_ARCHIVE_URL: "https://l2.example/graphql",
						SEPOLIA_OUTER_ACTIONS_PUBLIC_KEY: "outer-pk",
						SEPOLIA_INNER_ACTIONS_PUBLIC_KEY: "inner-pk"
					}
				)
			).resolves.toMatchObject({
				l2: {
					actionCoverageStatus: "missing",
					missingActionCount: 1,
					missingActionBlockCount: 1,
					firstMissingActionBlock: 1_050,
					latestArchiveActionBlock: 1_050
				}
			})
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it("flattens actions indexer database and canonical progress details", () => {
		expect(
			extractActionsIndexerDetails({
				healthPayload: {
					status: "healthy",
					service: { environment: "sepolia" },
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
			environment: "sepolia",
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

	it("reports L2 canonical action finality stalls as dashboard errors", () => {
		const stalledL2 = buildChainInsight({
			id: "l2",
			label: "L2 Zeko",
			indexerLabel: "Inner",
			indexer: {
				id: "actions-indexer",
				details: {
					lastFetchedInner: 1_097_358,
					innerLastFinalBlockHeight: 1_097_016,
					innerNonCanonicalTailCount: 17
				}
			},
			archive: {
				id: "l2-archive",
				details: {
					canonicalMaxBlockHeight: 1_097_396,
					pendingMaxBlockHeight: 1_097_396
				}
			},
			daemon: {
				id: "l2-daemon",
				details: {}
			},
			indexerHeightKey: "lastFetchedInner",
			indexerFinalHeightKey: "innerLastFinalBlockHeight",
			nonCanonicalTailKey: "innerNonCanonicalTailCount",
			expectedFinalityBlocks: null,
			daemonBlockHeightSupported: false
		})

		expect(actionFinalityState(stalledL2)).toBe("error")
		expect(actionFinalityLabel(stalledL2)).toBe("17 canonical actions not finalized in DB")
		expect(actionFinalityDetail(stalledL2)).toContain("archive canonical 1,097,396")
		expect(actionFinalityDetail(stalledL2)).toContain("DB final 1,097,016")
		expect(actionFinalityDetail(stalledL2)).toContain("indexed 1,097,358")
	})

	it("reports L1 non-final action tails as deposit finality warnings", () => {
		const blockedL1 = buildChainInsight({
			id: "l1",
			label: "L1 Mina",
			indexerLabel: "Outer",
			indexer: {
				id: "actions-indexer",
				details: {
					lastFetchedOuter: 528_625,
					outerLastFinalBlockHeight: 528_346,
					outerNonCanonicalTailCount: 29,
					l1ActionCoverageStatus: "current"
				}
			},
			archive: {
				id: "l1-archive",
				details: {
					canonicalMaxBlockHeight: 528_625,
					pendingMaxBlockHeight: 528_637
				}
			},
			daemon: {
				id: "l1-daemon",
				details: { blockHeight: 528_637 }
			},
			indexerHeightKey: "lastFetchedOuter",
			indexerFinalHeightKey: "outerLastFinalBlockHeight",
			nonCanonicalTailKey: "outerNonCanonicalTailCount",
			expectedFinalityBlocks: 290,
			daemonBlockHeightSupported: true
		})

		expect(actionFinalityState(blockedL1)).toBe("warn")
		expect(actionFinalityLabel(blockedL1)).toBe(
			"29 L1 actions not final; deposits and withdrawals may be blocked"
		)
		expect(actionFinalityDetail(blockedL1)).toContain("DB final 528,346")
		expect(actionFinalityDetail(blockedL1)).toContain("indexed 528,625")
	})

	it("does not hide L1 finality lag when archive coverage is unavailable", () => {
		const blockedL1 = buildChainInsight({
			id: "l1",
			label: "L1 Mina",
			indexerLabel: "Outer",
			indexer: {
				id: "actions-indexer",
				details: {
					lastFetchedOuter: 529_014,
					outerLastFinalBlockHeight: 528_722,
					outerNonCanonicalTailCount: 124
				}
			},
			archive: {
				id: "l1-archive",
				details: {
					canonicalMaxBlockHeight: 528_725,
					pendingMaxBlockHeight: 529_015
				}
			},
			daemon: {
				id: "l1-daemon",
				details: { blockHeight: 529_015 }
			},
			indexerHeightKey: "lastFetchedOuter",
			indexerFinalHeightKey: "outerLastFinalBlockHeight",
			nonCanonicalTailKey: "outerNonCanonicalTailCount",
			expectedFinalityBlocks: 290,
			daemonBlockHeightSupported: true
		})

		expect(actionFinalityState(blockedL1)).toBe("warn")
		expect(actionFinalityLabel(blockedL1)).toBe(
			"124 L1 actions not final; deposits and withdrawals may be blocked"
		)
		expect(actionFinalityDetail(blockedL1)).toContain("DB final 528,722")
		expect(actionFinalityDetail(blockedL1)).toContain("indexed 529,014")
		expect(actionFinalityDetail(blockedL1)).toContain("archive canonical 528,725")
	})

	it("reports L2 action finality stalls before any DB action is finalized", () => {
		const stalledL2 = buildChainInsight({
			id: "l2",
			label: "L2 Zeko",
			indexerLabel: "Inner",
			indexer: {
				id: "actions-indexer",
				details: {
					lastFetchedInner: 1_097_358,
					innerLastFinalBlockHeight: null,
					innerNonCanonicalTailCount: 17
				}
			},
			archive: {
				id: "l2-archive",
				details: {
					canonicalMaxBlockHeight: 1_097_396,
					pendingMaxBlockHeight: 1_097_396
				}
			},
			daemon: {
				id: "l2-daemon",
				details: {}
			},
			indexerHeightKey: "lastFetchedInner",
			indexerFinalHeightKey: "innerLastFinalBlockHeight",
			nonCanonicalTailKey: "innerNonCanonicalTailCount",
			expectedFinalityBlocks: null,
			daemonBlockHeightSupported: false
		})

		expect(actionFinalityState(stalledL2)).toBe("error")
		expect(actionFinalityLabel(stalledL2)).toBe("17 canonical actions not finalized in DB")
		expect(actionFinalityDetail(stalledL2)).toContain("DB final -")
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
