#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const platformKey = `${process.platform}-${process.arch}`
const ext = process.platform === "win32" ? ".exe" : ""

let binPath
try {
	binPath = require.resolve(`@zeko-labs/faucet-cli-${platformKey}/bin/zeko-faucet${ext}`)
} catch {
	console.error(
		`@zeko-labs/faucet-cli does not support ${process.platform}-${process.arch}. ` +
			"Please open an issue at https://github.com/nicekind/zeko-ui/issues"
	)
	process.exit(1)
}

try {
	execFileSync(binPath, process.argv.slice(2), { stdio: "inherit" })
} catch (e) {
	process.exit(e.status ?? 1)
}
