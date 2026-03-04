#!/usr/bin/env bun

import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()
const TARGETS = ["apps", "packages", "services"] as const
const FROM = "@zeko/bridge-sdk"
const TO = "@zeko-labs/bridge-sdk"
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".cts"])
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".moon", ".nuxt", ".output", "ataski"])

const hasTextExtension = (path: string) =>
	[...TEXT_EXTENSIONS].some((extension) => path.endsWith(extension))

async function rewritePackageJson(path: string): Promise<boolean> {
	const raw = await readFile(path, "utf8")
	const pkg = JSON.parse(raw) as Record<string, unknown>
	let changed = false

	for (const section of [
		"dependencies",
		"devDependencies",
		"peerDependencies",
		"optionalDependencies"
	] as const) {
		const entries = pkg[section]
		if (!entries || typeof entries !== "object") continue

		const values = entries as Record<string, string>
		if (FROM in values) {
			values[TO] = values[FROM]
			delete values[FROM]
			changed = true
		}

		for (const [name, specifier] of Object.entries(values)) {
			if (specifier !== FROM) continue
			values[name] = TO
			changed = true
		}
	}

	if (!changed) return false

	await writeFile(path, `${JSON.stringify(pkg, null, "\t")}\n`)
	return true
}

async function rewriteTextFile(path: string): Promise<boolean> {
	const raw = await readFile(path, "utf8")
	if (!raw.includes(FROM)) return false

	await writeFile(path, raw.replaceAll(FROM, TO))
	return true
}

async function walk(path: string): Promise<number> {
	const info = await stat(path)
	if (info.isDirectory()) {
		const name = path.split("/").at(-1)
		if (name && SKIP_DIRS.has(name)) return 0

		const entries = await readdir(path)
		let changed = 0
		for (const entry of entries) {
			changed += await walk(join(path, entry))
		}
		return changed
	}

	if (path.endsWith("package.json")) {
		return (await rewritePackageJson(path)) ? 1 : 0
	}

	if (!hasTextExtension(path)) return 0
	return (await rewriteTextFile(path)) ? 1 : 0
}

let changedFiles = 0
for (const target of TARGETS) {
	changedFiles += await walk(join(ROOT, target))
}

console.log(`Updated ${changedFiles} file(s).`)
