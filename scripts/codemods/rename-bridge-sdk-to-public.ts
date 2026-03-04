#!/usr/bin/env bun

import { execFileSync } from "node:child_process"

const pattern = "`@zeko/bridge-sdk` => `@zeko-labs/bridge-sdk`"

// Use Grit's string-literal rewrite so the migration stays declarative.
execFileSync("pnpm", ["dlx", "@getgrit/cli", "apply", pattern, "apps", "packages", "services"], {
	stdio: "inherit"
})
