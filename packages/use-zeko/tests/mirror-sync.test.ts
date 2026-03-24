import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const repoRoot = path.resolve(packageRoot, "..", "..")

describe("use-zeko mirror sync", () => {
	it("documents the standalone public-mirror flow in the package README", () => {
		const readmePath = path.join(packageRoot, "README.md")
		expect(fs.existsSync(readmePath)).toBe(true)

		const readme = fs.readFileSync(readmePath, "utf8")
		expect(readme).toContain("public mirror")
		expect(readme).toContain("sync-use-zeko.yaml")
		expect(readme).toContain("zeko/SKILL.md")
		expect(readme).not.toMatch(/\b(?:apps|packages|services|docs)\/[^\s)`]+/)
	})

	it("adds a dedicated sync wrapper workflow for the public mirror", () => {
		const workflowPath = path.join(repoRoot, ".github", "workflows", "sync-use-zeko.yaml")
		expect(fs.existsSync(workflowPath)).toBe(true)

		const workflow = fs.readFileSync(workflowPath, "utf8")
		expect(workflow).toContain("uses: ./.github/workflows/sync-package-repo.yaml")
		expect(workflow).toContain("package-path: packages/use-zeko")
		expect(workflow).toContain("standalone-repo: use-zeko")
		expect(workflow).toContain("project-id: use-zeko")
	})
})
