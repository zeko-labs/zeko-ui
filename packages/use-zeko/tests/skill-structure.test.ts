import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const skillPath = path.join(packageRoot, "SKILL.md")
const referencesDir = path.join(packageRoot, "references")
const requiredReferences = [
	"01-navigation.md",
	"10-users.md",
	"20-build-on-zeko.md",
	"30-bridge.md",
	"40-faucet.md",
	"50-o1js-and-tooling.md",
	"60-networks-and-endpoints.md",
	"70-architecture-and-protocol.md",
	"80-troubleshooting-and-boundaries.md",
	"99-source-of-truth.md"
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

	it("documents the canonical source-of-truth map", () => {
		const sourceOfTruth = fs.readFileSync(path.join(referencesDir, "99-source-of-truth.md"), "utf8")

		expect(sourceOfTruth).toContain("apps/docs/content")
		expect(sourceOfTruth).toContain("packages/bridge-sdk/README.md")
		expect(sourceOfTruth).toContain("packages/faucet-cli/README.md")
		expect(sourceOfTruth).toContain("packages/graphql/README.md")
		expect(sourceOfTruth).toContain("apps/bridge-ui/machines/helpers.ts")
		expect(sourceOfTruth).toContain("docs/CODEBASE_MAP.md")
	})
})
