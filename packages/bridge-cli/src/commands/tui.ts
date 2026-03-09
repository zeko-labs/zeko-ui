import { readFile } from "node:fs/promises"
import { defineCommand, type CommandDef } from "citty"
import { resolveAppPaths } from "../core/paths"
import { createSessionStore } from "../core/session-store"
import type { OperationSession } from "../core/types"

type TuiModule = typeof import("@opentui/core")

export const renderTuiSnapshot = ({
	sessions,
	focus,
	logContent
}: {
	sessions: OperationSession[]
	focus: OperationSession | null
	logContent: string
}): string => {
	const lines = ["zeko-bridge tui", "", "Controls: q quit, Ctrl-C quit", "", "Recent operations:"]

	if (sessions.length === 0) {
		lines.push("No persisted operations found.")
	} else {
		lines.push(
			...sessions.map((session) =>
				[
					session.id === focus?.id ? ">" : " ",
					session.id,
					session.status,
					session.route,
					`amount=${session.amount}`,
					`updated=${session.updatedAt}`
				].join(" ")
			)
		)
	}

	if (!focus) return lines.join("\n")

	lines.push(
		"",
		"Selected operation:",
		`ID: ${focus.id}`,
		`Status: ${focus.status}`,
		`Phase: ${focus.phase}`,
		`Route: ${focus.route}`,
		`Recipient: ${focus.recipient ?? focus.account}`,
		`Amount: ${focus.amount}`,
		`Log: ${focus.logPath}`,
		"",
		"Recent log lines:"
	)

	const tail = logContent.trim().split(/\r?\n/).filter(Boolean).slice(-12)

	lines.push(...(tail.length > 0 ? tail : ["No log entries yet."]))

	return lines.join("\n")
}

const readLogFile = async (logPath: string): Promise<string> => {
	try {
		return await readFile(logPath, "utf8")
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return ""
		}
		throw error
	}
}

export const createTuiCommand = ({
	loadRenderer
}: {
	loadRenderer?: () => Promise<TuiModule>
} = {}): CommandDef<any> =>
	defineCommand({
		meta: {
			name: "tui",
			description: "Open the bridge operation terminal UI."
		},
		args: {
			id: { type: "positional", required: false }
		},
		async run({ args }) {
			if (!("bun" in process.versions)) {
				throw new Error(
					"`tui` currently requires Bun because OpenTUI's native renderer is Bun-only. Use `bun x zeko-bridge tui`."
				)
			}

			const appPaths = resolveAppPaths()
			const store = createSessionStore({ stateDir: appPaths.stateDir })
			const targetId = args.id as string | undefined

			const rendererModule = await (loadRenderer ?? (() => import("@opentui/core")))()
			const { BoxRenderable, TextRenderable, createCliRenderer } = rendererModule

			let resolveDone: (() => void) | undefined
			const done = new Promise<void>((resolve) => {
				resolveDone = resolve
			})

			const renderer = await createCliRenderer({
				exitOnCtrlC: true,
				useAlternateScreen: true,
				onDestroy: () => resolveDone?.()
			})
			const frame = new BoxRenderable(renderer, {
				width: "100%",
				height: "100%",
				padding: 1
			})
			const body = new TextRenderable(renderer, {
				width: "100%",
				height: "100%",
				content: "Loading bridge operations..."
			})

			frame.add(body)
			renderer.root.add(frame)

			const refresh = async () => {
				const sessions = await store.list()
				const focus =
					targetId !== undefined
						? sessions.find((session) => session.id === targetId) ?? null
						: sessions[0] ?? null

				if (targetId !== undefined && focus === null) {
					throw new Error(`Operation ${targetId} not found`)
				}

				const logContent = focus ? await readLogFile(focus.logPath) : ""
				body.content = renderTuiSnapshot({ sessions, focus, logContent })
			}

			await refresh()
			const interval = setInterval(() => {
				void refresh().catch((error: unknown) => {
					body.content = error instanceof Error ? error.message : String(error)
				})
			}, 2_000)

			const close = () => {
				clearInterval(interval)
				if (!renderer.isDestroyed) {
					renderer.destroy()
				}
			}

			renderer.addInputHandler((sequence) => {
				if (sequence === "q" || sequence === "Q" || sequence === "\u001b") {
					close()
					return true
				}

				return false
			})

			renderer.start()
			await done
			clearInterval(interval)
		}
	})
