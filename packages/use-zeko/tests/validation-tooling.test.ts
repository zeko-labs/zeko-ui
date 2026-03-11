import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const repoRoot = path.resolve(packageRoot, "..", "..")

describe("use-zeko validation tooling", () => {
	it("ships the validation spec and CLI sources", () => {
		expect(fs.existsSync(path.join(packageRoot, "src", "cli.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "index.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "spec.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "sync-sources.ts"))).toBe(true)
	})

	it("declares validate, eval, and check moon tasks", () => {
		const moon = fs.readFileSync(path.join(packageRoot, "moon.yml"), "utf8")

		expect(moon).toContain("  validate:")
		expect(moon).toContain("  eval:")
		expect(moon).toContain("  check:")
		expect(moon).toContain("  sync-sources:")
	})

	it("adds a dedicated workflow with pull request and weekly schedule coverage", () => {
		const workflowPath = path.join(repoRoot, ".github", "workflows", "use-zeko-skill.yaml")
		expect(fs.existsSync(workflowPath)).toBe(true)

		const workflow = fs.readFileSync(workflowPath, "utf8")
		expect(workflow).toContain("pull_request:")
		expect(workflow).toContain("schedule:")
		expect(workflow).toContain("cron:")
		expect(workflow).toContain("moon run use-zeko:check")
	})

	it("enforces the simplified reference tree and agent-first constraints", () => {
		const skill = fs.readFileSync(path.join(packageRoot, "SKILL.md"), "utf8")

		expect(skill).toContain("private key")
		expect(skill).toContain("browser")
		expect(skill).not.toContain("99-source-of-truth")
		expect(skill).not.toContain("80-troubleshooting")
	})
})
