import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { defineCommand, type CommandDef } from "citty"
import { readString } from "./args"
import { resolveAppPaths } from "./env"
import { createSessionStore } from "./session"
import type { OperationSession } from "./types"
import { formatErrorMessage } from "./utils"

export const renderTuiSnapshot = ({
	sessions,
	focus,
	logContent
}: {
	sessions: OperationSession[]
	focus: OperationSession | null
	logContent: string
}): string => {
	const active = sessions.filter((session) => session.status === "running")
	const completed = sessions.filter((session) => session.status !== "running")
	const line = (session: OperationSession) =>
		[
			session.id === focus?.id ? ">" : " ",
			session.id,
			session.status,
			session.route,
			`amount=${session.amount}`,
			`updated=${session.updatedAt}`
		].join(" ")
	const lines = ["zeko-bridge tui", "", "Controls: q quit, Ctrl-C quit", "", "Active operations:"]
	lines.push(...(active.length ? active.map(line) : ["No active operations found."]))
	lines.push("", "Completed operations:")
	lines.push(...(completed.length ? completed.map(line) : ["No completed operations found."]))
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
	lines.push(...(tail.length ? tail : ["No log entries yet."]))
	return lines.join("\n")
}

export const createTuiCommand = ({
	loadRenderer,
	spawnBundledTui
}: {
	loadRenderer?: () => Promise<typeof import("@opentui/core")>
	spawnBundledTui?: (id?: string) => Promise<void>
} = {}): CommandDef => {
	const command = defineCommand({
		meta: { name: "tui", description: "Open the bridge operation terminal UI." },
		args: { id: { type: "positional", required: false } },
		async run({ args }) {
			const targetId = readString(args, "id")
			if (!("bun" in process.versions)) {
				if (spawnBundledTui) return spawnBundledTui(targetId)
				const require = createRequire(import.meta.url)
				const packageJsonPath = require.resolve("bun/package.json")
				const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { bin: { bun: string } }
				const cliPath = process.argv[1]
				if (!cliPath)
					throw new Error("Unable to determine the current CLI entrypoint for TUI respawn.")
				await new Promise<void>((resolve, reject) => {
					const child = spawn(
						path.join(path.dirname(packageJsonPath), pkg.bin.bun),
						[cliPath, "tui", ...(targetId ? [targetId] : [])],
						{ stdio: "inherit", env: process.env }
					)
					child.once("error", reject)
					child.once("exit", (code) =>
						code === 0
							? resolve()
							: reject(new Error(`Bundled Bun TUI exited with code ${code ?? "unknown"}`))
					)
				})
				return
			}
			const store = createSessionStore({ stateDir: resolveAppPaths().stateDir })
			const { BoxRenderable, TextRenderable, createCliRenderer } = await (
				loadRenderer ?? (() => import("@opentui/core"))
			)()
			let doneResolve: (() => void) | undefined
			const done = new Promise<void>((resolve) => {
				doneResolve = resolve
			})
			const renderer = await createCliRenderer({
				exitOnCtrlC: true,
				useAlternateScreen: true,
				onDestroy: () => doneResolve?.()
			})
			const frame = new BoxRenderable(renderer, { width: "100%", height: "100%", padding: 1 })
			const body = new TextRenderable(renderer, {
				width: "100%",
				height: "100%",
				content: "Loading bridge operations..."
			})
			frame.add(body)
			renderer.root.add(frame)
			const refresh = async () => {
				const sessions = await store.list()
				const focus = targetId
					? sessions.find((session) => session.id === targetId) ?? null
					: sessions[0] ?? null
				if (targetId && !focus) throw new Error(`Operation ${targetId} not found`)
				let logContent = ""
				if (focus) {
					try {
						logContent = await readFile(focus.logPath, "utf8")
					} catch (error) {
						if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
					}
				}
				body.content = renderTuiSnapshot({ sessions, focus, logContent })
			}
			await refresh()
			const interval = setInterval(
				() =>
					void refresh().catch((error) => {
						body.content = formatErrorMessage(error)
					}),
				2_000
			)
			renderer.addInputHandler((sequence) => {
				if (sequence === "q" || sequence === "Q" || sequence === "\u001b") {
					clearInterval(interval)
					if (!renderer.isDestroyed) renderer.destroy()
					return true
				}
				return false
			})
			renderer.start()
			await done
			clearInterval(interval)
		}
	})
	return command as CommandDef
}
