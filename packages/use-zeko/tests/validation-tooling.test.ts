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
		expect(fs.existsSync(path.join(packageRoot, "src", "check.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "evals", "opencode.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "spec.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "validation", "index.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "evals", "prompts.json"))).toBe(true)
	})

	it("declares validate, manual opencode eval, and check moon tasks", () => {
		const moon = fs.readFileSync(path.join(packageRoot, "moon.yml"), "utf8")

		expect(moon).toContain("  validate:")
		expect(moon).toContain("  eval-opencode:")
		expect(moon).toContain("  check:")
		expect(moon).toContain("  typecheck:")
		expect(moon).toContain("      runInCI: true")
		expect(moon).not.toContain("  eval:")
		expect(moon).not.toContain("  sync-sources:")
	})

	it("typechecks both source files and tests", () => {
		const tsconfig = fs.readFileSync(path.join(packageRoot, "tsconfig.json"), "utf8")

		expect(tsconfig).toContain('"include": ["src", "tests"]')
	})

	it("adds a dedicated workflow with pull request and weekly schedule coverage", () => {
		const workflowPath = path.join(repoRoot, ".github", "workflows", "use-zeko-skill.yaml")
		expect(fs.existsSync(workflowPath)).toBe(true)

		const workflow = fs.readFileSync(workflowPath, "utf8")
		expect(workflow).toContain("pull_request:")
		expect(workflow).toContain("schedule:")
		expect(workflow).toContain("cron:")
		expect(workflow).toContain("moon run -f use-zeko:check")
		expect(workflow).not.toContain("eval-opencode")
	})

	it("enforces the zeko skill directory and docs-first agent constraints", () => {
		const skill = fs.readFileSync(path.join(packageRoot, "zeko", "SKILL.md"), "utf8")

		expect(skill).toContain("private key")
		expect(skill).toContain("browser")
		expect(skill).toContain("docs.zeko.io")
		expect(skill).not.toContain("llms-full.txt")
		expect(skill).not.toContain("references/copied/")
		expect(skill).not.toContain("99-source-of-truth")
		expect(skill).not.toContain("80-troubleshooting")
	})
})
