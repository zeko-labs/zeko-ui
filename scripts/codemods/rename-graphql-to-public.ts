#!/usr/bin/env bun

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const TARGETS = [".changeset", ".github", "apps", "docs", "packages", "services", "pnpm-lock.yaml"]
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".moon", ".nuxt", ".output", "coverage"])
const TEXT_EXTENSIONS = new Set([
	".json",
	".md",
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".mts",
	".cts",
	".yaml",
	".yml",
	".css",
	".html",
	".vue"
])

const REPLACEMENTS = [
	["@zeko/graphql", "@zeko-labs/graphql"],
	["zeko-graphql-", "zeko-labs-graphql-"]
] as const

const hasTextExtension = (path: string) =>
	[...TEXT_EXTENSIONS].some((extension) => path.endsWith(extension))

const rewriteFile = (path: string): boolean => {
	if (!hasTextExtension(path) && !path.endsWith("pnpm-lock.yaml")) {
		return false
	}

	const original = readFileSync(path, "utf8")
	const updated = REPLACEMENTS.reduce(
		(content, [from, to]) => content.replaceAll(from, to),
		original
	)

	if (updated === original) {
		return false
	}

	writeFileSync(path, updated)
	return true
}

const walk = (path: string): number => {
	const info = statSync(path)
	if (info.isDirectory()) {
		const name = path.split("/").at(-1)
		if (name && SKIP_DIRS.has(name)) {
			return 0
		}

		return readdirSync(path).reduce((count, entry) => count + walk(join(path, entry)), 0)
	}

	return rewriteFile(path) ? 1 : 0
}

const changedFiles = TARGETS.reduce((count, target) => count + walk(join(ROOT, target)), 0)
console.log(`Updated ${changedFiles} file(s).`)
