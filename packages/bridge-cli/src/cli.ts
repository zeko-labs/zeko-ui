#!/usr/bin/env node

import { runMain } from "citty"
import { createBridgeCliCommand, loadBridgeCliEnv } from "./app"

if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) {
	await loadBridgeCliEnv()
	await runMain(createBridgeCliCommand())
}
