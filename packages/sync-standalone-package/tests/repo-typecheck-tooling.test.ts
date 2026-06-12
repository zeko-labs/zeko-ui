import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(thisDir, "..", "..", "..")

const collectMoonFiles = (rootDir: string) => {
	const files: string[] = []
	const stack = [rootDir]
	const ignoredDirectories = new Set([
		".agents",
		".git",
		".moon",
		"ataski",
		"node_modules",
		"dist",
		"coverage"
	])

	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) continue

		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const absolutePath = path.join(current, entry.name)
			if (entry.isDirectory()) {
				if (!ignoredDirectories.has(entry.name)) stack.push(absolutePath)
				continue
			}

			if (entry.isFile() && entry.name === "moon.yml") files.push(absolutePath)
		}
	}

	return files.sort((left, right) => left.localeCompare(right))
}

describe("repository typecheck tooling", () => {
	it("uses tsgo for direct TypeScript compiler Moon tasks", () => {
		const directTscTasks = collectMoonFiles(repoRoot)
			.map((filePath) => ({
				filePath,
				source: fs.readFileSync(filePath, "utf8")
			}))
			.filter(({ source }) => /command:\s+tsc(?:\s|$)/.test(source))
			.map(({ filePath }) => path.relative(repoRoot, filePath))

		expect(directTscTasks).toEqual([])

		const rootPackage = JSON.parse(
			fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
		) as { devDependencies?: Record<string, string> }
		const workspace = fs.readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8")

		expect(rootPackage.devDependencies).toHaveProperty("@typescript/native-preview")
		expect(workspace).toMatch(/['"]?@typescript\/native-preview['"]?:/)
	})
})
