#!/usr/bin/env node

import { runCheck } from "./check.js"
import { runOpencodeEvals } from "./evals/opencode.js"
import { runValidation } from "./validation/index.js"

const command = process.argv[2] ?? "check"

const run = async () => {
	switch (command) {
		case "validate":
			await runValidation()
			console.log("use-zeko validation passed")
			return
		case "check":
			await runCheck()
			console.log("use-zeko check passed")
			return
		case "eval-opencode":
			await runOpencodeEvals()
			console.log("use-zeko opencode evals passed")
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
