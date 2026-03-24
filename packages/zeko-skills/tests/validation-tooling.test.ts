import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const repoRoot = path.resolve(packageRoot, "..", "..")

describe("zeko-skills validation tooling", () => {
	it("ships the validation spec and CLI sources", () => {
		expect(fs.existsSync(path.join(packageRoot, "src", "cli.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "check.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "evals", "opencode.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "publish-clawhub.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "public-install.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "spec.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "validation", "clawhub.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "validation", "index.ts"))).toBe(true)
		expect(fs.existsSync(path.join(packageRoot, "src", "validation", "public-surface.ts"))).toBe(
			true
		)
		expect(fs.existsSync(path.join(packageRoot, "evals", "prompts.json"))).toBe(true)
	})

	it("declares validation, manual eval, and ClawHub publish moon tasks", () => {
		const moon = fs.readFileSync(path.join(packageRoot, "moon.yml"), "utf8")

		expect(moon).toContain("  validate:")
		expect(moon).toContain("  validate-public-install:")
		expect(moon).toContain("  eval-opencode:")
		expect(moon).toContain("  publish-clawhub:")
		expect(moon).toContain("  check:")
		expect(moon).toContain("  typecheck:")
		expect(moon).toContain("      runInCI: true")
		expect(moon).toContain("    - TESTING.md")
		expect(moon).not.toContain("  eval:")
		expect(moon).not.toContain("  sync-sources:")
	})

	it("typechecks both source files and tests", () => {
		const tsconfig = fs.readFileSync(path.join(packageRoot, "tsconfig.json"), "utf8")

		expect(tsconfig).toContain('"include": ["src", "tests"]')
	})

	it("adds a dedicated workflow with pull request and weekly schedule coverage", () => {
		const workflowPath = path.join(repoRoot, ".github", "workflows", "zeko-skills.yaml")
		expect(fs.existsSync(workflowPath)).toBe(true)

		const workflow = fs.readFileSync(workflowPath, "utf8")
		expect(workflow).toContain("pull_request:")
		expect(workflow).toContain("schedule:")
		expect(workflow).toContain("cron:")
		expect(workflow).toContain("moon run -f zeko-skills:check")
		expect(workflow).not.toContain("eval-opencode")
	})

	it("enforces the zeko skill directory and docs-first agent constraints", () => {
		const skill = fs.readFileSync(path.join(packageRoot, "zeko", "SKILL.md"), "utf8")

		expect(skill).toContain("metadata:")
		expect(skill).toContain("openclaw:")
		expect(skill).toContain("WALLET_PRIVATE_KEY")
		expect(skill).toContain("MINA_PRIVATE_KEY")
		expect(skill).toContain("GITHUB_TOKEN")
		expect(skill).toContain("@zeko-labs/bridge-cli")
		expect(skill).toContain("@zeko-labs/faucet-cli")
		expect(skill).toContain("o1js")
		expect(skill).toContain("browser")
		expect(skill).toContain("docs.zeko.io")
		expect(skill).not.toContain("llms-full.txt")
		expect(skill).not.toContain("references/copied/")
		expect(skill).not.toContain("99-source-of-truth")
		expect(skill).not.toContain("80-troubleshooting")
	})

	it("keeps maintainer-only guidance in TESTING.md instead of the public README", () => {
		const readme = fs.readFileSync(path.join(packageRoot, "README.md"), "utf8")
		const testing = fs.readFileSync(path.join(packageRoot, "TESTING.md"), "utf8")

		expect(readme).toContain("npx skills add https://github.com/zeko-labs/zeko-skills --skill zeko")
		expect(readme).not.toContain("moon run")
		expect(testing).toContain("moon run -f zeko-skills:test")
		expect(testing).toContain("moon run -f zeko-skills:check")
		expect(testing).toContain("moon run -f zeko-skills:validate-public-install")
		expect(testing).toContain("moon run -f zeko-skills:publish-clawhub")
		expect(testing).toContain(
			"npx skills add https://github.com/zeko-labs/zeko-skills --skill zeko"
		)
	})

	it("publishes to ClawHub automatically after mirror sync on main", () => {
		const workflowPath = path.join(repoRoot, ".github", "workflows", "sync-zeko-skills.yaml")
		const workflow = fs.readFileSync(workflowPath, "utf8")

		expect(workflow).toContain("publish-clawhub:")
		expect(workflow).toContain("needs: validate-public-install")
		expect(workflow).toContain("if: github.event_name == 'push'")
		expect(workflow).toContain("CLAWHUB_TOKEN")
		expect(workflow).toContain("moon run -f zeko-skills:publish-clawhub")
	})
})
