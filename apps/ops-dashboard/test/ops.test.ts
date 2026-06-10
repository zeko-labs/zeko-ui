import { describe, expect, it } from "vitest"
import {
	extractActionsIndexerDetails,
	getOpsConfig,
	normalizeEndpoint,
	resolveOpsNetwork,
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
			l2DaemonUrl: "https://mainnet.zeko.io/graphql"
		})
		expect(getOpsConfig("testnet")).toMatchObject({
			network: "testnet",
			actionsIndexerUrl: "https://testnet.indexer.actions.zeko.io",
			l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
			l2DaemonUrl: "https://testnet.zeko.io/graphql"
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
})
