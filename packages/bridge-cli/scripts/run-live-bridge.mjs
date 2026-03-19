#!/usr/bin/env node

import { spawn } from "node:child_process"

const [, , from, to, direction] = process.argv

if (!from || !to || !direction) {
	console.error("Usage: node ./scripts/run-live-bridge.mjs <from> <to> <direction>")
	process.exit(1)
}

const expectedRoute = `${from}->${to}`

const validateResult = (result) => {
	if (!result.success) {
		throw new Error("Bridge result reported success=false")
	}

	if (result.route !== expectedRoute) {
		throw new Error(`Expected route ${expectedRoute}, got ${result.route}`)
	}

	if (result.direction !== direction) {
		throw new Error(`Expected direction ${direction}, got ${result.direction}`)
	}

	if (result.status !== "completed") {
		throw new Error(`Expected completed status, got ${result.status}`)
	}

	if (result.submitted_transactions.length === 0) {
		throw new Error("Expected at least one submitted transaction")
	}

	if (!result.final_transaction) {
		throw new Error("Expected a final transaction in the result")
	}

	if (!result.log_path) {
		throw new Error("Expected a log path in the result")
	}
}

const child = spawn(
	process.execPath,
	["./dist/cli.js", "bridge", "--from", from, "--to", to, "--amount", "1", "--json"],
	{
		cwd: new URL("..", import.meta.url),
		env: process.env,
		stdio: ["ignore", "pipe", "pipe"]
	}
)

let stdout = ""
let stderr = ""

child.stdout.setEncoding("utf8")
child.stdout.on("data", (chunk) => {
	stdout += chunk
})

child.stderr.setEncoding("utf8")
child.stderr.on("data", (chunk) => {
	stderr += chunk
	process.stderr.write(chunk)
})

child.on("error", (error) => {
	console.error(error)
	process.exit(1)
})

child.on("close", (code) => {
	if (code !== 0) {
		console.error(`Bridge command exited with ${code ?? "unknown"}`)
		if (stderr) {
			console.error(stderr)
		}
		process.exit(code ?? 1)
	}

	try {
		const result = JSON.parse(stdout)
		validateResult(result)
		console.log(JSON.stringify(result, null, 2))
	} catch (error) {
		console.error(
			error instanceof Error ? error.message : `Failed to validate bridge result: ${String(error)}`
		)
		process.exit(1)
	}
})
