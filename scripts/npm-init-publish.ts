#!/usr/bin/env bun
/**
 * Initial publish script for registering new npm packages.
 *
 * Publishes all packages at version 0.0.0 so the names are claimed
 * on the registry without conflicting with the real release version.
 *
 * Uses pnpm publish which handles workspace:* and catalog: resolution.
 *
 * After publishing, configure trusted publishing on each package at:
 *   https://www.npmjs.com/package/<name>/access
 *
 * Usage:
 *   bun scripts/npm-init-publish.ts <package-dir> [--otp <code>]
 *
 * Example:
 *   bun scripts/npm-init-publish.ts packages/faucet-cli --otp 123456
 */

import { execSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

interface PackageJson {
	name: string
	version: string
	[key: string]: unknown
}

const INIT_VERSION = "0.0.0"

function readJson(path: string): PackageJson {
	return JSON.parse(readFileSync(path, "utf-8")) as PackageJson
}

function writeJson(path: string, data: PackageJson): void {
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`)
}

function isPublished(name: string, version: string): boolean {
	try {
		const url = `https://registry.npmjs.org/${name.replace("/", "%2f")}/${version}`
		const status = execSync(`curl -s -o /dev/null -w '%{http_code}' '${url}'`, {
			encoding: "utf-8"
		}).trim()
		return status === "200"
	} catch {
		return false
	}
}

function publish(dir: string, otp: string | undefined): void {
	const otpFlag = otp ? ` --otp ${otp}` : ""
	execSync(`pnpm publish --access public --no-git-checks${otpFlag}`, {
		cwd: dir,
		stdio: "inherit"
	})
}

// --- Parse args ---

const args = process.argv.slice(2)
const packageDir = args.find((a: string) => !a.startsWith("--"))
const otpIndex = args.indexOf("--otp")
const otp = otpIndex !== -1 ? args[otpIndex + 1] : undefined

if (!packageDir) {
	console.error("Usage: bun scripts/npm-init-publish.ts <package-dir> [--otp <code>]")
	process.exit(1)
}

const root = resolve(packageDir)
const npmDir = resolve(root, "npm")

// --- Collect all package.json paths ---

const pkgPaths: string[] = [resolve(root, "package.json")]
if (existsSync(npmDir)) {
	for (const dir of readdirSync(npmDir).filter((d: string) => !d.startsWith("."))) {
		pkgPaths.push(resolve(npmDir, dir, "package.json"))
	}
}

// --- Temporarily set version to 0.0.0 and publish ---

const originals = new Map<string, string>()

try {
	for (const pkgPath of pkgPaths) {
		originals.set(pkgPath, readFileSync(pkgPath, "utf-8"))
		const pkg = readJson(pkgPath)
		pkg.version = INIT_VERSION
		writeJson(pkgPath, pkg)
	}

	// Publish platform packages first, then the main package
	const platformPaths = pkgPaths.filter((p: string) => p.includes("/npm/"))
	const mainPath = pkgPaths.find((p: string) => !p.includes("/npm/"))!

	for (const pkgPath of [...platformPaths, mainPath]) {
		const pkg = readJson(pkgPath)
		if (isPublished(pkg.name, INIT_VERSION)) {
			console.log(`\nSkipping ${pkg.name}@${INIT_VERSION} — already published.`)
			continue
		}
		console.log(`\nPublishing ${pkg.name}@${INIT_VERSION}...`)
		publish(resolve(pkgPath, ".."), otp)
	}

	console.log("\nAll packages published successfully.")
	console.log("\nNext steps:")
	console.log("  1. Configure trusted publishing for each package at:")
	for (const pkgPath of pkgPaths) {
		const original = JSON.parse(originals.get(pkgPath)!) as PackageJson
		console.log(`     https://www.npmjs.com/package/${original.name}/access`)
	}
	console.log(
		"  2. Set Organization: <github-org>, Repository: <repo>, Workflow: <release-workflow>.yaml"
	)
} finally {
	for (const [pkgPath, content] of originals) {
		writeFileSync(pkgPath, content)
	}
}
