#!/usr/bin/env node

import { defineCommand, runMain, type CommandDef } from "citty"
import { createBridgeCommand } from "./commands/bridge"
import { createDoctorCommand } from "./commands/doctor"
import { createDepositCommand, createWithdrawalCommand } from "./commands/direct"
import { createOperationCommand } from "./commands/operation"
import { createTuiCommand } from "./commands/tui"
import { loadBridgeCliEnv } from "./core/env"

export const createBridgeCli = (): CommandDef =>
	defineCommand({
		meta: {
			name: "zeko-bridge",
			version: "0.0.0",
			description: "Agent-first CLI for bridging between Mina and Zeko."
		},
		subCommands: {
			bridge: createBridgeCommand(),
			deposit: createDepositCommand(),
			withdrawal: createWithdrawalCommand(),
			operation: createOperationCommand(),
			tui: createTuiCommand(),
			doctor: createDoctorCommand()
		}
	})

if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) {
	await loadBridgeCliEnv()
	await runMain(createBridgeCli())
}
