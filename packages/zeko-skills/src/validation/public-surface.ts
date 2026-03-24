import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { packageRoot } from "../config.js"
import { publicSyncMappings } from "../spec.js"
import { assert } from "../utils.js"

const copySyncPath = (
	stagingRoot: string,
	sourceRelativePath: string,
	targetRelativePath: string
) => {
	const sourcePath = path.join(packageRoot, sourceRelativePath)
	const targetPath = path.join(stagingRoot, targetRelativePath)

	assert(fs.existsSync(sourcePath), `Missing public sync path: ${sourceRelativePath}`)
	fs.mkdirSync(path.dirname(targetPath), { recursive: true })
	fs.cpSync(sourcePath, targetPath, { recursive: true })
}

export const validatePublicMirrorSurface = () => {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zeko-skills-surface-"))
	const stagingRoot = path.join(tempRoot, "surface")

	try {
		fs.mkdirSync(stagingRoot, { recursive: true })

		for (const mapping of publicSyncMappings) {
			copySyncPath(stagingRoot, mapping.source, mapping.target)
		}

		const publicEntries = fs
			.readdirSync(stagingRoot)
			.sort((left, right) => left.localeCompare(right))

		assert(
			JSON.stringify(publicEntries) === JSON.stringify(["README.md", "skills"]),
			`Unexpected standalone export surface: ${publicEntries.join(", ")}`
		)
		assert(fs.existsSync(path.join(stagingRoot, "README.md")), "Missing staged public README.md")
		assert(
			fs.existsSync(path.join(stagingRoot, "skills", "zeko", "SKILL.md")),
			"Missing staged skills/zeko/SKILL.md"
		)
		assert(
			!fs.existsSync(path.join(stagingRoot, "TESTING.md")),
			"TESTING.md leaked into public surface"
		)
	} finally {
		fs.rmSync(tempRoot, { recursive: true, force: true })
	}
}
