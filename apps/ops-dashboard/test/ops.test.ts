import { describe, expect, it } from "vitest"
import { normalizeEndpoint, summarizeServices, type ServiceProbe } from "../server/utils/ops"

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
})
