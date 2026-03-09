#!/usr/bin/env node

import { defineCommand, runMain, type CommandDef } from "citty"
import { createPlaceholderCommand } from "./commands/placeholder"

export const createBridgeCli = (): CommandDef =>
	defineCommand({
		meta: {
			name: "zeko-bridge",
			version: "0.1.0",
			description: "Agent-first CLI for bridging between Mina and Zeko."
		},
		subCommands: {
			bridge: createPlaceholderCommand({
				name: "bridge",
				description: "Run a full bridge flow from source to destination."
			}),
			deposit: createPlaceholderCommand({
				name: "deposit",
				description: "Perform deposit-level bridge operations."
			}),
			withdrawal: createPlaceholderCommand({
				name: "withdrawal",
				description: "Perform withdrawal-level bridge operations."
			}),
			operation: createPlaceholderCommand({
				name: "operation",
				description: "Inspect or resume persisted bridge operations."
			}),
			tui: createPlaceholderCommand({
				name: "tui",
				description: "Open the bridge operation terminal UI."
			}),
			doctor: createPlaceholderCommand({
				name: "doctor",
				description: "Check CLI prerequisites and environment configuration."
			})
		}
	})

if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) {
	await runMain(createBridgeCli())
}
