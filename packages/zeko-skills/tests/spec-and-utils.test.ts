import path from "node:path"
import { describe, expect, it } from "vitest"
import {
	endpointChecks,
	forbiddenMarkdownPatterns,
	skippedExternalLinkChecks
} from "../src/spec.js"
import { endsWithPathSegment, normalizePath } from "../src/utils.js"

describe("zeko-skills spec and utils", () => {
	it("keeps forbidden markdown patterns stateless across repeated checks", () => {
		for (const pattern of forbiddenMarkdownPatterns) {
			expect(pattern.global).toBe(false)
		}

		expect(forbiddenMarkdownPatterns[0]?.test("docs/private-page.md")).toBe(true)
		expect(forbiddenMarkdownPatterns[0]?.test("docs/another-private-page.md")).toBe(true)
		expect(forbiddenMarkdownPatterns[1]?.test("../outside-skill")).toBe(true)
		expect(forbiddenMarkdownPatterns[2]?.test("/Users/example/project")).toBe(true)
	})

	it("configures endpoint validation only for retained Sepolia services", () => {
		expect(
			endpointChecks.map(({ name, documentedUrl, deployedSources }) => ({
				name,
				documentedUrl,
				deployedSources
			}))
		).toEqual([
			{
				name: "zeko sepolia graphql",
				documentedUrl: "https://sepolia-gateway.zeko.io/graphql",
				deployedSources: ["northflank/actions-indexer/project.json"]
			},
			{
				name: "zeko sepolia archive graphql",
				documentedUrl: "https://archive.sepolia.zeko.io/graphql",
				deployedSources: ["northflank/actions-indexer/project.json"]
			},
			{
				name: "sepolia actions api",
				documentedUrl: "https://sepolia.api.actions.zeko.io/graphql",
				deployedSources: ["services/actions/api/wrangler.jsonc"]
			}
		])
	})

	it("skips the currently unavailable legacy mainnet and testnet GraphQL endpoints", () => {
		expect(skippedExternalLinkChecks.has("https://mainnet.zeko.io/graphql")).toBe(true)
		expect(skippedExternalLinkChecks.has("https://api.actions.zeko.io/graphql")).toBe(true)
		expect(skippedExternalLinkChecks.has("https://api.faucet.zeko.io/claim")).toBe(true)
		expect(skippedExternalLinkChecks.has("https://testnet.zeko.io/graphql")).toBe(true)
		expect(skippedExternalLinkChecks.has("https://archive.testnet.zeko.io/graphql")).toBe(true)
		expect(skippedExternalLinkChecks.has("https://bridge.zeko.io")).toBe(true)
		expect(skippedExternalLinkChecks.has("https://faucet.zeko.io")).toBe(true)
	})

	it("matches absolute skill paths against repo-relative suffixes", () => {
		const absoluteSkillPath = path.join(path.sep, "repo", ".agents", "skills", "zeko", "SKILL.md")
		const relativeSkillSuffix = path.join(".agents", "skills", "zeko", "SKILL.md")

		expect(normalizePath(absoluteSkillPath)).toBe(absoluteSkillPath)
		expect(endsWithPathSegment(absoluteSkillPath, relativeSkillSuffix)).toBe(true)
		expect(
			endsWithPathSegment(
				path.join(
					path.sep,
					"repo",
					"packages",
					"zeko-skills",
					"zeko",
					"references",
					"10-navigation.md"
				),
				path.join("references", "10-navigation.md")
			)
		).toBe(true)
		expect(
			endsWithPathSegment(
				path.join(
					path.sep,
					"repo",
					"packages",
					"zeko-skills",
					"zeko",
					"references",
					"10-navigation.md"
				),
				path.join("references", "20-user-flows.md")
			)
		).toBe(false)
	})

	it("tracks Sepolia endpoints against their current deployment configuration", () => {
		const checkedSources = endpointChecks.flatMap((check) => [
			...check.documentedSources,
			...(check.deployedSources ?? [])
		])

		expect(checkedSources).toContain("northflank/actions-indexer/project.json")
		expect(checkedSources).toContain("services/actions/api/wrangler.jsonc")
		expect(
			checkedSources.every(
				(source) =>
					source.startsWith("packages/zeko-skills/zeko/references/") ||
					source === "northflank/actions-indexer/project.json" ||
					source === "services/actions/api/wrangler.jsonc"
			)
		).toBe(true)
	})
})
