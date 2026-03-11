import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const skillPath = path.join(packageRoot, "SKILL.md")
const referencesDir = path.join(packageRoot, "references")
const requiredReferences = [
	"10-agent-workflows.md",
	"20-build-on-zeko.md",
	"30-bridge-sdk.md",
	"40-faucet-cli.md",
	"50-endpoints.md",
	"60-architecture.md",
	"copied/bridge-sdk-readme.md",
	"copied/faucet-cli-readme.md"
]

describe("use-zeko skill structure", () => {
	it("ships the router skill and every required reference file", () => {
		expect(fs.existsSync(skillPath)).toBe(true)
		expect(fs.existsSync(referencesDir)).toBe(true)

		for (const referenceFile of requiredReferences) {
			expect(fs.existsSync(path.join(referencesDir, referenceFile))).toBe(true)
		}
	})

	it("links every required reference directly from the root skill", () => {
		const skill = fs.readFileSync(skillPath, "utf8")

		for (const referenceFile of requiredReferences) {
			expect(skill).toContain(`references/${referenceFile}`)
		}
	})

	it("keeps shipped markdown self-contained to the skill directory", () => {
		const markdownFiles = [
			skillPath,
			path.join(packageRoot, "README.md"),
			...requiredReferences.map((referenceFile) => path.join(referencesDir, referenceFile))
		]

		for (const markdownFile of markdownFiles) {
			const content = fs.readFileSync(markdownFile, "utf8")
			expect(content).not.toMatch(/\b(?:apps|packages|services|docs)\/[^\s)`]+/)
			expect(content).not.toContain("../")
			expect(content).not.toContain("/Users/")
		}
	})
})
