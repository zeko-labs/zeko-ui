#!/usr/bin/env node

/**
 * Publishes all faucet-cli packages using npm publish with OIDC provenance.
 *
 * Platform packages are published directly with npm.
 * The main package uses pnpm pack to resolve workspace:* protocols,
 * then npm publish on the resulting tarball.
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
	execSync("npm publish --provenance --access public", {
		cwd: dir,
		stdio: "inherit"
	})
}

console.log("Publishing @zeko-labs/faucet-cli...")
execSync("pnpm pack --pack-destination ./", { cwd: root, stdio: "inherit" })
const tarball = readdirSync(root).find((f) => f.endsWith(".tgz"))
if (!tarball) throw new Error("pnpm pack did not produce a tarball")
execSync(`npm publish ${tarball} --provenance --access public`, {
	cwd: root,
	stdio: "inherit"
})

console.log("All packages published successfully.")
