#!/usr/bin/env node

import { runMain } from "citty"
import { shouldRunBridgeCli } from "./core/entrypoint"
import { loadBridgeCliEnv } from "./core/env"
import { createBridgeCliCommand } from "./core/root-command"

if (shouldRunBridgeCli({ moduleUrl: import.meta.url })) {
	await loadBridgeCliEnv()
	await runMain(createBridgeCliCommand())
}
