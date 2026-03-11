import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const skillRoot = path.join(packageRoot, "zeko")
const skillPath = path.join(skillRoot, "SKILL.md")
const referencesDir = path.join(skillRoot, "references")
const requiredReferences = [
	"10-navigation.md",
	"10-agent-workflows.md",
	"20-user-flows.md",
	"30-bridge-and-faucet.md",
	"40-endpoints-and-curl.md",
	"50-build-on-zeko.md",
	"60-sequencer-archive-and-da.md"
]

describe("use-zeko skill structure", () => {
	it("ships the router skill and every required reference file", () => {
		expect(fs.existsSync(skillRoot)).toBe(true)
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

		expect(skill).toContain("docs.zeko.io")
		expect(skill).not.toContain("references/copied/")
	})

	it("keeps shipped markdown self-contained to the skill directory and rich enough for agents", () => {
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

		const endpointsAndCurl = fs.readFileSync(
			path.join(referencesDir, "40-endpoints-and-curl.md"),
			"utf8"
		)
		expect(endpointsAndCurl).toContain("curl")
		expect(endpointsAndCurl).toContain("sequencerPk")
		expect(endpointsAndCurl).toContain("archive")

		const protocol = fs.readFileSync(
			path.join(referencesDir, "60-sequencer-archive-and-da.md"),
			"utf8"
		)
		expect(protocol).toContain("sequencer")
		expect(protocol).toContain("archive node")
		expect(protocol).toContain("DA layer")
	})
})
