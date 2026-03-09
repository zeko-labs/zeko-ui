import { readFile } from "node:fs/promises"
import { defineCommand, type CommandDef } from "citty"
import { runBridgeOperation } from "./bridge"
import { createOperationLogger } from "../core/logger"
import { resolveAppPaths } from "../core/paths"
import { renderBridgeResult, renderOperationProgress, toBridgeJsonResult } from "../core/reporter"
import { createSessionStore } from "../core/session-store"
import type { ChainRef } from "../core/routes"
import { resolveRoute } from "../core/routes"

export const createOperationCommand = (): CommandDef =>
	defineCommand({
		meta: {
			name: "operation",
			description: "Inspect or resume persisted bridge operations."
		},
		subCommands: {
			list: defineCommand({
				meta: { name: "list", description: "List persisted operations." },
				async run() {
					const store = createSessionStore({ stateDir: resolveAppPaths().stateDir })
					console.log(JSON.stringify(await store.list(), null, 2))
				}
			}),
			status: defineCommand({
				meta: { name: "status", description: "Show one persisted operation." },
				args: {
					id: { type: "positional", required: true }
				},
				async run({ args }) {
					const store = createSessionStore({ stateDir: resolveAppPaths().stateDir })
					console.log(JSON.stringify(await store.load(args.id as string), null, 2))
				}
			}),
			logs: defineCommand({
				meta: { name: "logs", description: "Print the log file for an operation." },
				args: {
					id: { type: "positional", required: true }
				},
				async run({ args }) {
					const store = createSessionStore({ stateDir: resolveAppPaths().stateDir })
					const session = await store.load(args.id as string)
					if (!session) throw new Error(`Operation ${args.id as string} not found`)
					console.log(await readFile(session.logPath, "utf8"))
				}
			}),
			resume: defineCommand({
				meta: { name: "resume", description: "Resume a persisted operation." },
				args: {
					id: { type: "positional", required: true },
					json: { type: "boolean", default: false }
				},
				async run({ args }) {
					const appPaths = resolveAppPaths()
					const store = createSessionStore({ stateDir: appPaths.stateDir })
					const session = await store.load(args.id as string)
					if (!session) throw new Error(`Operation ${args.id as string} not found`)
					const [from, to] = session.route.split("->") as [ChainRef, ChainRef]
					const logger = createOperationLogger({ logPath: session.logPath })
					const { createBridgeAdapter } = await import("../core/adapter")
					const resumed = await runBridgeOperation(
						{
							id: session.id,
							from,
							to,
							amount: session.amount,
							account: session.account,
							recipient: session.recipient,
							timeoutSlots: session.timeoutSlots,
							session
						},
						{
							adapter: createBridgeAdapter({ route: resolveRoute(from, to) }),
							sessionStore: store,
							log: async ({ event, phase, details }) => {
								console.error(renderOperationProgress({ event, phase, details }))
								await logger.write(event, { phase, ...details })
							},
							sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
							pollIntervalMs: 20_000
						}
					)
					console.log(
						args.json
							? JSON.stringify(toBridgeJsonResult(resumed), null, 2)
							: renderBridgeResult(resumed)
					)
				}
			})
		}
	})
