import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { publicSyncMappings } from "../src/spec.js"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const repoRoot = path.resolve(packageRoot, "..", "..")

describe("zeko-skills mirror sync", () => {
	it("adds a dedicated sync wrapper workflow for the public mirror", () => {
		const workflowPath = path.join(repoRoot, ".github", "workflows", "sync-zeko-skills.yaml")
		expect(fs.existsSync(workflowPath)).toBe(true)

		const workflow = fs.readFileSync(workflowPath, "utf8")
		expect(workflow).toContain("uses: ./.github/workflows/sync-package-repo.yaml")
		expect(workflow).toContain("package-path: packages/zeko-skills")
		expect(workflow).toContain("standalone-repo: zeko-skills")
		expect(workflow).toContain("project-id: zeko-skills")
		expect(workflow).toContain(
			`sync-paths: ${publicSyncMappings.map((mapping) => `${mapping.source}:${mapping.target}`).join(",")}`
		)
		expect(workflow).toContain("validate-public-install:")
		expect(workflow).toContain("moon exec --ignore-ci-checks zeko-skills:validate-public-install")
	})

	it("supports syncing mapped public paths into the standalone repo", () => {
		const workflow = fs.readFileSync(
			path.join(repoRoot, ".github", "workflows", "sync-package-repo.yaml"),
			"utf8"
		)

		expect(workflow).toContain("sync-paths:")
		expect(workflow).toContain('SYNC_PATHS="${{ inputs.sync-paths }}"')
		expect(workflow).toContain('SOURCE_REL_PATH="${REL_PATH%%:*}"')
		expect(workflow).toContain('TARGET_REL_PATH="${REL_PATH#*:}"')
		expect(workflow).toContain('cp -a "$SOURCE_PATH" "$TARGET_PATH"')
	})
})
