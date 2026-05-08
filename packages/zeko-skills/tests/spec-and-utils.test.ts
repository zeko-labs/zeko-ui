import path from "node:path"
import { describe, expect, it } from "vitest"
import { endpointChecks, forbiddenMarkdownPatterns } from "../src/spec.js"
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

	it("tracks Mina devnet consumers through Zeko proxy endpoints", () => {
		const minaGateway = endpointChecks.find((check) => check.name === "mina gateway")
		const minaArchiveGateway = endpointChecks.find((check) => check.name === "mina archive gateway")

		expect(minaGateway?.expected).toEqual([
			"https://gateway.mina.devnet.zeko.io",
			"gateway.mina.devnet.zeko.io"
		])
		expect(minaGateway?.sources).toEqual([
			"apps/bridge-ui/machines/helpers.ts",
			"packages/graphql/moon.yml",
			"services/mina-proxy/wrangler.jsonc"
		])
		expect(minaArchiveGateway?.expected).toEqual([
			"https://gateway.mina.archive.devnet.zeko.io",
			"gateway.mina.archive.devnet.zeko.io"
		])
		expect(minaArchiveGateway?.sources).toEqual([
			"apps/bridge-ui/machines/helpers.ts",
			"packages/graphql/moon.yml",
			"services/mina-archive-proxy/wrangler.jsonc"
		])
	})
})
