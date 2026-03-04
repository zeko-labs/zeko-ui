#!/usr/bin/env node

/**
 * Publishes all faucet-cli packages via OIDC trusted publishing.
 * Platform packages use npm publish directly.
 * Main package uses pnpm pack (to resolve workspace:* / catalog:) then npm publish.
 * Provenance is disabled because the source repo is private.
 */

import { execSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"

const run = (cmd, opts) => {
	console.log(`$ ${cmd}`)
	return execSync(cmd, { stdio: "inherit", ...opts })
}

const root = resolve(import.meta.dirname, "..")
const npmDir = resolve(root, "npm")

// Debug: show npm/pnpm versions and auth config
run("npm --version")
run("pnpm --version")
run("npm config list")

const platforms = readdirSync(npmDir).filter((d) => !d.startsWith("."))

for (const platform of platforms) {
	const dir = resolve(npmDir, platform)
	console.log(`\nPublishing @zeko-labs/faucet-cli-${platform}...`)
	run("npm publish --access public --provenance=false --loglevel verbose", { cwd: dir })
}

console.log("\nPublishing @zeko-labs/faucet-cli...")
// pnpm pack resolves workspace:* and catalog: protocols
run("pnpm pack", { cwd: root })
const pkg = JSON.parse(
	execSync("node -p \"JSON.stringify(require('./package.json'))\"", { cwd: root }).toString()
)
const tarball = `zeko-labs-faucet-cli-${pkg.version}.tgz`
run(`npm publish ${tarball} --access public --provenance=false --loglevel verbose`, { cwd: root })

console.log("\nAll packages published successfully.")
