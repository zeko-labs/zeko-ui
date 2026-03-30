#!/usr/bin/env node

import { runCheck } from "./check.js"
import { runOpencodeEvals } from "./evals/opencode.js"
import { publishClawhub } from "./publish-clawhub.js"
import { runPublicInstallValidation } from "./public-install.js"
import { runValidation } from "./validation/index.js"

const command = process.argv[2] ?? "check"

const run = async () => {
	switch (command) {
		case "validate":
			await runValidation()
			console.log("zeko-skills validation passed")
			return
		case "check":
			await runCheck()
			console.log("zeko-skills check passed")
			return
		case "validate-public-install":
			await runPublicInstallValidation()
			console.log("zeko-skills public install validation passed")
			return
		case "eval-opencode":
			await runOpencodeEvals()
			console.log("zeko-skills opencode evals passed")
			return
		case "publish-clawhub":
			await publishClawhub()
			return
		default:
			throw new Error(`Unknown command: ${command}`)
	}
}

run().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(message)
	process.exitCode = 1
})
