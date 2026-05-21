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

	it("tracks Mina gateway documentation against deployed routes only", () => {
		const minaGatewayChecks = endpointChecks.filter((check) => check.name.includes("mina gateway"))
		const minaArchiveGatewayChecks = endpointChecks.filter((check) =>
			check.name.includes("mina archive gateway")
		)

		expect(minaGatewayChecks).toEqual([
			expect.objectContaining({
				name: "mina gateway devnet",
				documentedUrl: "https://gateway.mina.devnet.zeko.io",
				documentedSources: [
					"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
					"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
				],
				deployedSources: ["services/mina-proxy-devnet/wrangler.jsonc"]
			}),
			expect.objectContaining({
				name: "mina gateway mainnet",
				documentedUrl: "https://gateway.mina.mainnet.zeko.io",
				documentedSources: [
					"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
					"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
				],
				deployedSources: ["services/mina-proxy-mainnet/wrangler.jsonc"]
			})
		])

		expect(minaArchiveGatewayChecks).toEqual([
			expect.objectContaining({
				name: "mina archive gateway devnet",
				documentedUrl: "https://gateway.mina.archive.devnet.zeko.io",
				documentedSources: [
					"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
					"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
				],
				deployedSources: ["services/mina-archive-proxy-devnet/wrangler.jsonc"]
			}),
			expect.objectContaining({
				name: "mina archive gateway mainnet",
				documentedUrl: "https://gateway.mina.archive.mainnet.zeko.io",
				documentedSources: [
					"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
					"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
				],
				deployedSources: ["services/mina-archive-proxy-mainnet/wrangler.jsonc"]
			})
		])

		const checkedSources = endpointChecks.flatMap((check) => [
			...check.documentedSources,
			...(check.deployedSources ?? [])
		])
		expect(
			checkedSources.every(
				(source) =>
					source.startsWith("packages/zeko-skills/zeko/references/") ||
					source.endsWith("/wrangler.jsonc")
			)
		).toBe(true)
		expect(checkedSources.some((source) => source.endsWith("moon.yml"))).toBe(false)
		expect(checkedSources.some((source) => source.includes("/machines/"))).toBe(false)
	})
})
