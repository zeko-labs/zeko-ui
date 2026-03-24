import path from "node:path"
import { describe, expect, it } from "vitest"
import { forbiddenMarkdownPatterns } from "../src/spec.js"
import { endsWithPathSegment, normalizePath } from "../src/utils.js"

describe("use-zeko spec and utils", () => {
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
					"use-zeko",
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
					"use-zeko",
					"zeko",
					"references",
					"10-navigation.md"
				),
				path.join("references", "20-user-flows.md")
			)
		).toBe(false)
	})
})
