#!/usr/bin/env node

import { runCheck, runEvals, runValidation } from "./index.js"

const command = process.argv[2] ?? "check"

const run = async () => {
	switch (command) {
		case "validate":
			await runValidation()
			console.log("use-zeko validation passed")
			return
		case "eval":
			runEvals()
			console.log("use-zeko evals passed")
			return
		case "check":
			await runCheck()
			console.log("use-zeko check passed")
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
