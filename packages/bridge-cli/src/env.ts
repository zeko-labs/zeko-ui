import { constants } from "node:fs"
import { access } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadDotenvConfig } from "dotenv"
import type { AppPaths } from "./types"

const APP_DIR_NAME = "zeko-bridge"

export const resolveAppPaths = ({
	env = process.env,
	platform = process.platform
}: {
	env?: Partial<Record<string, string | undefined>>
	platform?: NodeJS.Platform
} = {}): AppPaths => {
	const home = env.HOME ?? os.homedir()
	if (platform === "darwin") {
		return {
			dataDir: path.join(home, "Library", "Application Support", APP_DIR_NAME),
			stateDir: path.join(home, "Library", "Application Support", APP_DIR_NAME, "state"),
			logDir: path.join(home, "Library", "Logs", APP_DIR_NAME),
			cacheDir: path.join(home, "Library", "Caches", APP_DIR_NAME)
		}
	}
	if (platform === "win32") {
		const appData = env.APPDATA ?? path.join(home, "AppData", "Roaming")
		const localAppData = env.LOCALAPPDATA ?? path.join(home, "AppData", "Local")
		return {
			dataDir: path.join(appData, APP_DIR_NAME),
			stateDir: path.join(localAppData, APP_DIR_NAME, "state"),
			logDir: path.join(localAppData, APP_DIR_NAME, "logs"),
			cacheDir: path.join(localAppData, APP_DIR_NAME, "cache")
		}
	}
	const dataRoot = env.XDG_DATA_HOME ?? path.join(home, ".local", "share")
	const stateRoot = env.XDG_STATE_HOME ?? path.join(home, ".local", "state")
	const cacheRoot = env.XDG_CACHE_HOME ?? path.join(home, ".cache")
	return {
		dataDir: path.join(dataRoot, APP_DIR_NAME),
		stateDir: path.join(stateRoot, APP_DIR_NAME),
		logDir: path.join(stateRoot, APP_DIR_NAME, "logs"),
		cacheDir: path.join(cacheRoot, APP_DIR_NAME)
	}
}

export const resolveBridgeCliDotenvPaths = ({
	homeDir = os.homedir(),
	cliModuleUrl = import.meta.url,
	argv = process.argv,
	cwd = process.cwd()
}: {
	homeDir?: string
	cliModuleUrl?: string
	argv?: string[]
	cwd?: string
} = {}): string[] => {
	const candidates = [path.join(homeDir, ".zeko", ".env")]
	const cliBinaryPath = fileURLToPath(cliModuleUrl)
	candidates.push(path.join(path.dirname(cliBinaryPath), ".env"))
	if (argv[1]) {
		const invocation = path.isAbsolute(argv[1]) ? argv[1] : path.resolve(cwd, argv[1])
		candidates.push(path.join(path.dirname(invocation), ".env"))
	}
	return [...new Set(candidates)]
}

export const loadBridgeCliEnv = async ({
	env = process.env,
	paths = resolveBridgeCliDotenvPaths(),
	canRead = async (filePath: string) => {
		try {
			await access(filePath, constants.R_OK)
			return true
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code
			if (code === "ENOENT" || code === "EACCES") return false
			throw error
		}
	},
	loadConfig = (filePath: string, processEnv: Record<string, string>) =>
		loadDotenvConfig({ path: filePath, processEnv, override: false, quiet: true })
}: {
	env?: Record<string, string | undefined>
	paths?: string[]
	canRead?: (filePath: string) => Promise<boolean>
	loadConfig?: (
		filePath: string,
		processEnv: Record<string, string>
	) => { parsed?: Record<string, string>; error?: Error }
} = {}): Promise<{ loadedPaths: string[] }> => {
	const loadedValues: Record<string, string> = {}
	const loadedPaths: string[] = []
	for (const filePath of paths) {
		if (!(await canRead(filePath))) continue
		const result = loadConfig(filePath, loadedValues)
		if (result.error) throw result.error
		loadedPaths.push(filePath)
	}
	for (const [key, value] of Object.entries(env)) {
		if (loadedValues[key] === undefined && value !== undefined) loadedValues[key] = value
	}
	Object.assign(env, loadedValues)
	return { loadedPaths }
}
