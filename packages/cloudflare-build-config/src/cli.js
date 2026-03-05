// @ts-check

import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const CONFIG_BASENAME = "workers-build.jsonc"
const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url))
const SEARCH_ROOTS = ["apps", "services", "unused"]
const SKIP_DIRS = new Set([
	".git",
	".moon",
	".nuxt",
	".output",
	".wrangler",
	"dist",
	"node_modules"
])

const normalizeList = (value) =>
	Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : value ? [value] : []

const normalizeStringArray = (value) =>
	Array.isArray(value) ? value.filter((item) => typeof item === "string") : []

const arraysEqual = (left, right) =>
	left.length === right.length && left.every((value, index) => value === right[index])

const getRequiredEnv = (name) => {
	const value = process.env[name]?.trim()

	if (!value) {
		throw new Error(`${name} is required.`)
	}

	return value
}

const readJsonFile = async (filePath) => {
	const text = await readFile(filePath, "utf8")
	return JSON.parse(text)
}

const readWorkersBuildConfig = async (configPath) => {
	const config = await readJsonFile(configPath)
	const scriptName =
		typeof config.scriptName === "string" && config.scriptName.trim()
			? config.scriptName.trim()
			: null
	const enabled = config.enabled !== false

	if (enabled && !scriptName) {
		throw new Error(`Unable to resolve script name for ${configPath}.`)
	}

	const baseBuildCommand = typeof config.buildCommand === "string" ? config.buildCommand : ""
	const baseRootDirectory = typeof config.rootDirectory === "string" ? config.rootDirectory : ""
	const triggers = normalizeList(config.triggers).map((trigger) => {
		if (typeof trigger?.name !== "string" || typeof trigger?.deployCommand !== "string") {
			throw new Error(`Invalid trigger definition in ${configPath}.`)
		}

		return {
			name: trigger.name,
			buildCommand:
				typeof trigger.buildCommand === "string" ? trigger.buildCommand : baseBuildCommand,
			deployCommand: trigger.deployCommand,
			rootDirectory:
				typeof trigger.rootDirectory === "string" ? trigger.rootDirectory : baseRootDirectory,
			branchIncludes: normalizeStringArray(trigger.branchIncludes),
			branchExcludes: normalizeStringArray(trigger.branchExcludes),
			pathIncludes: normalizeStringArray(trigger.pathIncludes),
			pathExcludes: normalizeStringArray(trigger.pathExcludes)
		}
	})

	return {
		configPath,
		enabled,
		scriptName,
		triggers
	}
}

const discoverConfigFiles = async (explicitPaths) => {
	if (explicitPaths.length > 0) {
		return explicitPaths.map((target) => resolve(WORKSPACE_ROOT, target))
	}

	const found = []

	const walk = async (directory) => {
		const entries = await readdir(directory, { withFileTypes: true })

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (SKIP_DIRS.has(entry.name)) {
					continue
				}

				await walk(join(directory, entry.name))
				continue
			}

			if (entry.isFile() && entry.name === CONFIG_BASENAME) {
				found.push(join(directory, entry.name))
			}
		}
	}

	for (const root of SEARCH_ROOTS) {
		await walk(join(WORKSPACE_ROOT, root))
	}

	return found.sort()
}

const createClient = (token, accountId) => {
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`

	const request = async (path, init = {}) => {
		const response = await fetch(`${baseUrl}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				Accept: "application/json",
				...(init.headers ?? {})
			}
		})

		const text = await response.text()
		const data = text ? JSON.parse(text) : {}

		if (!response.ok || data.success === false) {
			throw new Error(
				`Cloudflare API request failed for ${path}: ${JSON.stringify(data.errors ?? data, null, 2)}`
			)
		}

		return data
	}

	let scriptsByNamePromise = null

	const getScriptsByName = async () => {
		if (!scriptsByNamePromise) {
			scriptsByNamePromise = request("/workers/scripts").then((data) => {
				const scripts = new Map()

				for (const script of normalizeList(data.result)) {
					if (typeof script?.id === "string" && typeof script?.tag === "string") {
						scripts.set(script.id, script.tag)
					}
				}

				return scripts
			})
		}

		return scriptsByNamePromise
	}

	const listTriggers = async (scriptName) => {
		const scriptsByName = await getScriptsByName()
		const externalScriptId = scriptsByName.get(scriptName)

		if (!externalScriptId) {
			throw new Error(`Cloudflare Workers script ${scriptName} was not found.`)
		}

		const data = await request(`/builds/workers/${externalScriptId}/triggers`)
		return normalizeList(data.result)
	}

	const patchTrigger = async (triggerUuid, payload) =>
		request(`/builds/triggers/${triggerUuid}`, {
			method: "PATCH",
			body: JSON.stringify(payload)
		})

	return {
		listTriggers,
		patchTrigger
	}
}

const createDesiredPayload = (trigger) => ({
	trigger_name: trigger.name,
	build_command: trigger.buildCommand,
	deploy_command: trigger.deployCommand,
	root_directory: trigger.rootDirectory,
	branch_includes: trigger.branchIncludes,
	branch_excludes: trigger.branchExcludes,
	path_includes: trigger.pathIncludes,
	path_excludes: trigger.pathExcludes
})

const needsUpdate = (existingTrigger, desiredTrigger) =>
	existingTrigger.build_command !== desiredTrigger.build_command ||
	existingTrigger.deploy_command !== desiredTrigger.deploy_command ||
	(existingTrigger.root_directory ?? "") !== desiredTrigger.root_directory ||
	!arraysEqual(
		normalizeStringArray(existingTrigger.branch_includes),
		desiredTrigger.branch_includes
	) ||
	!arraysEqual(
		normalizeStringArray(existingTrigger.branch_excludes),
		desiredTrigger.branch_excludes
	) ||
	!arraysEqual(normalizeStringArray(existingTrigger.path_includes), desiredTrigger.path_includes) ||
	!arraysEqual(normalizeStringArray(existingTrigger.path_excludes), desiredTrigger.path_excludes)

const syncProject = async (client, projectConfig, dryRun) => {
	const remoteTriggers = await client.listTriggers(projectConfig.scriptName)

	for (const trigger of projectConfig.triggers) {
		const existingTrigger = remoteTriggers.find((remote) => remote?.trigger_name === trigger.name)

		if (!existingTrigger?.trigger_uuid) {
			throw new Error(
				`Missing Cloudflare Build trigger "${trigger.name}" for ${projectConfig.scriptName}.`
			)
		}

		const desiredPayload = createDesiredPayload(trigger)

		if (!needsUpdate(existingTrigger, desiredPayload)) {
			console.log(
				`= ${projectConfig.scriptName}: ${trigger.name} already matches ${projectConfig.configPath}`
			)
			continue
		}

		if (dryRun) {
			console.log(`~ ${projectConfig.scriptName}: would update ${trigger.name}`)
			continue
		}

		await client.patchTrigger(existingTrigger.trigger_uuid, desiredPayload)
		console.log(`+ ${projectConfig.scriptName}: updated ${trigger.name}`)
	}
}

const main = async () => {
	const args = process.argv.slice(2)
	const dryRun = args.includes("--dry-run")
	const explicitPaths = args.filter((arg) => arg !== "--dry-run")
	const token = getRequiredEnv("CLOUDFLARE_API_TOKEN")
	const accountId = getRequiredEnv("CLOUDFLARE_ACCOUNT_ID")

	const configPaths = await discoverConfigFiles(explicitPaths)

	if (configPaths.length === 0) {
		throw new Error(`No ${CONFIG_BASENAME} files were found.`)
	}

	const client = createClient(token, accountId)
	const projectConfigs = await Promise.all(
		configPaths.map((configPath) => readWorkersBuildConfig(configPath))
	)

	for (const projectConfig of projectConfigs) {
		if (!projectConfig.enabled) {
			console.log(`- skipped ${projectConfig.configPath}`)
			continue
		}

		await syncProject(client, projectConfig, dryRun)
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
