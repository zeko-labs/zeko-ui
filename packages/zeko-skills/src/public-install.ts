import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { assert } from "./utils.js"

const publicSource =
	process.env.ZEKO_SKILLS_PUBLIC_SOURCE?.trim() || "https://github.com/zeko-labs/zeko-skills"

export const runPublicInstallValidation = async () => {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zeko-skills-public-install-"))
	const projectRoot = path.join(tempRoot, "project")

	try {
		fs.mkdirSync(projectRoot, { recursive: true })

		execFileSync("npx", ["--yes", "skills", "add", publicSource, "--skill", "zeko", "-y"], {
			cwd: projectRoot,
			encoding: "utf8",
			timeout: 120_000,
			maxBuffer: 20 * 1024 * 1024
		})

		assert(
			fs.existsSync(path.join(projectRoot, ".agents", "skills", "zeko", "SKILL.md")),
			`skills CLI did not install zeko from ${publicSource}`
		)
		assert(
			fs.existsSync(path.join(projectRoot, ".agents", "skills", "zeko", "references")),
			`skills CLI did not install the zeko references from ${publicSource}`
		)
		assert(
			fs.existsSync(path.join(projectRoot, "skills-lock.json")),
			`skills CLI did not create skills-lock.json when installing ${publicSource}`
		)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`skills CLI public install failed for ${publicSource}: ${message}`)
	} finally {
		fs.rmSync(tempRoot, { recursive: true, force: true })
	}
}
