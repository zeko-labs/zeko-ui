import { beforeEach, describe, expect, it, vi } from "vitest"

describe("inner action finality", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/actions")
		vi.stubEnv("AUTH_TOKEN", "test")
		vi.stubEnv("L1_ARCHIVE_URL", "https://l1.example/graphql")
		vi.stubEnv("L2_ARCHIVE_URL", "https://l2.example/graphql")
		vi.stubEnv("OUTER_PK", "outer-pk")
		vi.stubEnv("INNER_PK", "inner-pk")
	})

	it("uses archive canonical status for L2 action finality", async () => {
		const { isCanonicalInnerActionBlock } = await import("../src/modules/inner")

		expect(isCanonicalInnerActionBlock({ chainStatus: "canonical" })).toBe(true)
		expect(isCanonicalInnerActionBlock({ chainStatus: "pending" })).toBe(false)
		expect(isCanonicalInnerActionBlock({ chainStatus: "orphaned" })).toBe(false)
	})
})
