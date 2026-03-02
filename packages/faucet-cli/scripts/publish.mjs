#!/usr/bin/env node

/**
 * Publishes all faucet-cli packages atomically.
 * If any platform package fails, the process exits immediately.
 */

import { execSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const npmDir = resolve(root, "npm")

const platforms = readdirSync(npmDir).filter((d) => !d.startsWith("."))

for (const platform of platforms) {
	const dir = resolve(npmDir, platform)
	console.log(`Publishing @zeko-labs/faucet-cli-${platform}...`)
	execSync("npm publish --provenance --access public", { cwd: dir, stdio: "inherit" })
}

console.log("Publishing @zeko-labs/faucet-cli...")
execSync("npm publish --provenance --access public", { cwd: root, stdio: "inherit" })

console.log("All packages published successfully.")
