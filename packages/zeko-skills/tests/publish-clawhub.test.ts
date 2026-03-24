import { afterEach, describe, expect, it, vi } from "vitest"
import {
	resolveClawhubPublishChangelog,
	resolveClawhubPublishTags,
	resolveClawhubPublishVersion
} from "../src/publish-clawhub.js"

const envBackup = { ...process.env }

afterEach(() => {
	process.env = { ...envBackup }
	vi.unstubAllEnvs()
})

describe("zeko-skills clawhub publish metadata", () => {
	it("derives a unique CI version from the base package version and run metadata", () => {
		vi.stubEnv("GITHUB_RUN_NUMBER", "123")
		vi.stubEnv("GITHUB_RUN_ATTEMPT", "2")
		delete process.env.ZEKO_SKILLS_CLAWHUB_VERSION

		expect(resolveClawhubPublishVersion()).toBe("0.0.1-main.123.2")
	})

	it("prefers an explicit publish version when provided", () => {
		vi.stubEnv("ZEKO_SKILLS_CLAWHUB_VERSION", "0.0.9")
		vi.stubEnv("GITHUB_RUN_NUMBER", "123")
		vi.stubEnv("GITHUB_RUN_ATTEMPT", "2")

		expect(resolveClawhubPublishVersion()).toBe("0.0.9")
	})

	it("derives the default changelog from the GitHub SHA", () => {
		vi.stubEnv("GITHUB_SHA", "abcdef1234567890")
		delete process.env.ZEKO_SKILLS_CLAWHUB_CHANGELOG

		expect(resolveClawhubPublishChangelog()).toBe("Auto-publish from zeko-ui@abcdef1")
	})

	it("falls back to latest when tags are blank after trimming", () => {
		vi.stubEnv("ZEKO_SKILLS_CLAWHUB_TAGS", " ,  , ")

		expect(resolveClawhubPublishTags()).toEqual(["latest"])
	})
})
