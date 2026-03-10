import { readFile } from "node:fs/promises"
import { defineCommand, type CommandDef } from "citty"
import { runBridgeOperation } from "./bridge"
import type { BridgeAdapter } from "../core/adapter"
import { createOperationLogger } from "../core/logger"
import { resolveAppPaths } from "../core/paths"
import { renderBridgeResult, renderOperationProgress, toBridgeJsonResult } from "../core/reporter"
import { createSessionStore, type SessionStore } from "../core/session-store"
import type { ChainRef } from "../core/routes"
import { parseRouteString, resolveRoute } from "../core/routes"

type OperationCommandDeps = {
	createStore?: (input: { stateDir: string }) => Pick<SessionStore, "list" | "load" | "save">
	resolvePaths?: typeof resolveAppPaths
	createAdapter?: (input: { from: ChainRef; to: ChainRef }) =>
		| Promise<BridgeAdapter>
		| BridgeAdapter
	readLog?: (path: string) => Promise<string>
	createLogger?: (input: { logPath: string }) => Pick<
		ReturnType<typeof createOperationLogger>,
		"write"
	>
	write?: (message: string) => void
	writeProgress?: (message: string) => void
	sleep?: (ms: number) => Promise<void>
	pollIntervalMs?: number
}

const parseId = (value: unknown): string => {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error("Missing required operation id")
	}

	return value
}

const parseJsonFlag = (value: unknown): boolean => (typeof value === "boolean" ? value : false)

const parseRoutePair = (value: string): [ChainRef, ChainRef] => parseRouteString(value)

export const createOperationCommand = (deps: OperationCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: {
			name: "operation",
			description: "Inspect or resume persisted bridge operations."
		},
		subCommands: {
			list: defineCommand({
				meta: { name: "list", description: "List persisted operations." },
				async run() {
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					;(deps.write ?? console.log)(JSON.stringify(await store.list(), null, 2))
				}
			}),
			status: defineCommand({
				meta: { name: "status", description: "Show one persisted operation." },
				args: {
					id: { type: "positional", required: true }
				},
				async run({ args }) {
					const id = parseId(args.id)
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					;(deps.write ?? console.log)(JSON.stringify(await store.load(id), null, 2))
				}
			}),
			logs: defineCommand({
				meta: { name: "logs", description: "Print the log file for an operation." },
				args: {
					id: { type: "positional", required: true }
				},
				async run({ args }) {
					const id = parseId(args.id)
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					;(deps.write ?? console.log)(
						await (deps.readLog ?? ((path) => readFile(path, "utf8")))(session.logPath)
					)
				}
			}),
			resume: defineCommand({
				meta: { name: "resume", description: "Resume a persisted operation." },
				args: {
					id: { type: "positional", required: true },
					json: { type: "boolean", default: false }
				},
				async run({ args }) {
					const id = parseId(args.id)
					const json = parseJsonFlag(args.json)
					const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
					const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					const [from, to] = parseRoutePair(session.route)
					const logger = (deps.createLogger ?? createOperationLogger)({
						logPath: session.logPath
					})
					const createAdapter =
						deps.createAdapter ??
						(async ({
							from: inputFrom,
							to: inputTo
						}: {
							from: ChainRef
							to: ChainRef
						}) => {
							const { createBridgeAdapter } = await import("../core/adapter")
							return createBridgeAdapter({ route: resolveRoute(inputFrom, inputTo) })
						})
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
							adapter: await createAdapter({ from, to }),
							sessionStore: store,
							log: async ({ event, phase, details }) => {
								;(deps.writeProgress ?? console.error)(
									renderOperationProgress({ event, phase, details })
								)
								await logger.write(event, { phase, ...details })
							},
							sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
							pollIntervalMs: deps.pollIntervalMs ?? 20_000
						}
					)
					;(deps.write ?? console.log)(
						json
							? JSON.stringify(toBridgeJsonResult(resumed), null, 2)
							: renderBridgeResult(resumed)
					)
				}
			})
		}
	})
