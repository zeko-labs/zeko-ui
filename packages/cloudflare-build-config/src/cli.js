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

const normalizeEnvironmentVariables = (value, configPath) => {
	if (value == null) {
		return {}
	}

	if (typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Invalid environmentVariables definition in ${configPath}.`)
	}

	return Object.fromEntries(
		Object.entries(value).map(([name, definition]) => {
			if (
				!name.trim() ||
				typeof definition !== "object" ||
				definition == null ||
				Array.isArray(definition)
			) {
				throw new Error(`Invalid environment variable ${name} in ${configPath}.`)
			}

			const value =
				typeof definition.value === "string" && definition.value.trim() ? definition.value : null
			const valueFromEnv =
				typeof definition.valueFromEnv === "string" && definition.valueFromEnv.trim()
					? definition.valueFromEnv.trim()
					: null

			if ((value == null && valueFromEnv == null) || (value != null && valueFromEnv != null)) {
				throw new Error(
					`Environment variable ${name} in ${configPath} must define exactly one of value or valueFromEnv.`
				)
			}

			return [
				name,
				{
					secret: definition.secret === true,
					value,
					valueFromEnv
				}
			]
		})
	)
}

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
	const triggerTemplateScriptName =
		typeof config.triggerTemplateScriptName === "string" && config.triggerTemplateScriptName.trim()
			? config.triggerTemplateScriptName.trim()
			: null
	const pruneScriptNames = normalizeStringArray(config.pruneScriptNames)
	const baseEnvironmentVariables = normalizeEnvironmentVariables(
		config.environmentVariables,
		configPath
	)
	const triggers = normalizeList(config.triggers).map((trigger) => {
		if (typeof trigger?.name !== "string" || typeof trigger?.deployCommand !== "string") {
			throw new Error(`Invalid trigger definition in ${configPath}.`)
		}

		const triggerEnvironmentVariables = normalizeEnvironmentVariables(
			trigger.environmentVariables,
			configPath
		)

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
			pathExcludes: normalizeStringArray(trigger.pathExcludes),
			environmentVariables: {
				...baseEnvironmentVariables,
				...triggerEnvironmentVariables
			}
		}
	})

	return {
		configPath,
		enabled,
		scriptName,
		triggerTemplateScriptName,
		pruneScriptNames,
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

	const getExternalScriptId = async (scriptName) => {
		const scriptsByName = await getScriptsByName()
		const externalScriptId = scriptsByName.get(scriptName)

		if (!externalScriptId) {
			throw new Error(`Cloudflare Workers script ${scriptName} was not found.`)
		}

		return externalScriptId
	}

	const createTrigger = async (payload) =>
		request("/builds/triggers", {
			method: "POST",
			body: JSON.stringify(payload)
		})

	const patchTrigger = async (triggerUuid, payload) =>
		request(`/builds/triggers/${triggerUuid}`, {
			method: "PATCH",
			body: JSON.stringify(payload)
		})

	const deleteTrigger = async (triggerUuid) =>
		request(`/builds/triggers/${triggerUuid}`, {
			method: "DELETE"
		})

	const upsertEnvironmentVariables = async (triggerUuid, payload) =>
		request(`/builds/triggers/${triggerUuid}/environment_variables`, {
			method: "PATCH",
			body: JSON.stringify(payload)
		})

	return {
		createTrigger,
		deleteTrigger,
		getExternalScriptId,
		listTriggers,
		patchTrigger,
		upsertEnvironmentVariables
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

const createEnvironmentVariablesPayload = (trigger) =>
	Object.fromEntries(
		Object.entries(trigger.environmentVariables).map(([name, definition]) => {
			const value = definition.valueFromEnv
				? getRequiredEnv(definition.valueFromEnv)
				: definition.value

			return [
				name,
				{
					is_secret: definition.secret,
					value
				}
			]
		})
	)

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
	let templateTriggersPromise = null

	const getTriggerTemplate = async () => {
		if (!projectConfig.triggerTemplateScriptName) {
			throw new Error(
				`Missing Cloudflare Build trigger template for ${projectConfig.scriptName}; set triggerTemplateScriptName in ${projectConfig.configPath}.`
			)
		}

		if (!templateTriggersPromise) {
			templateTriggersPromise = client.listTriggers(projectConfig.triggerTemplateScriptName)
		}

		const templateTriggers = await templateTriggersPromise
		const template = templateTriggers.find(
			(trigger) => trigger?.build_token_uuid && trigger?.repo_connection?.repo_connection_uuid
		)

		if (!template) {
			throw new Error(
				`Unable to find a usable Cloudflare Build trigger template on ${projectConfig.triggerTemplateScriptName}.`
			)
		}

		return template
	}

	for (const trigger of projectConfig.triggers) {
		const existingTrigger = remoteTriggers.find((remote) => remote?.trigger_name === trigger.name)
		const desiredPayload = createDesiredPayload(trigger)
		const environmentVariableNames = Object.keys(trigger.environmentVariables)

		if (!existingTrigger?.trigger_uuid) {
			if (dryRun) {
				console.log(`+ ${projectConfig.scriptName}: would create ${trigger.name}`)
				if (environmentVariableNames.length > 0) {
					console.log(
						`~ ${projectConfig.scriptName}: would sync env vars for ${trigger.name}: ${environmentVariableNames.join(", ")}`
					)
				}
				continue
			}

			const template = await getTriggerTemplate()
			const externalScriptId = await client.getExternalScriptId(projectConfig.scriptName)
			const createdTrigger = await client.createTrigger({
				...desiredPayload,
				external_script_id: externalScriptId,
				build_token_uuid: template.build_token_uuid,
				repo_connection_uuid: template.repo_connection.repo_connection_uuid
			})
			console.log(`+ ${projectConfig.scriptName}: created ${trigger.name}`)

			if (environmentVariableNames.length > 0) {
				await client.upsertEnvironmentVariables(
					createdTrigger.result.trigger_uuid,
					createEnvironmentVariablesPayload(trigger)
				)
				console.log(`+ ${projectConfig.scriptName}: synced env vars for ${trigger.name}`)
			}
			continue
		}

		if (!needsUpdate(existingTrigger, desiredPayload)) {
			console.log(
				`= ${projectConfig.scriptName}: ${trigger.name} already matches ${projectConfig.configPath}`
			)
		} else if (dryRun) {
			console.log(`~ ${projectConfig.scriptName}: would update ${trigger.name}`)
			continue
		} else {
			await client.patchTrigger(existingTrigger.trigger_uuid, desiredPayload)
			console.log(`+ ${projectConfig.scriptName}: updated ${trigger.name}`)
		}

		if (environmentVariableNames.length > 0) {
			if (dryRun) {
				console.log(
					`~ ${projectConfig.scriptName}: would sync env vars for ${trigger.name}: ${environmentVariableNames.join(", ")}`
				)
				continue
			}

			await client.upsertEnvironmentVariables(
				existingTrigger.trigger_uuid,
				createEnvironmentVariablesPayload(trigger)
			)
			console.log(`+ ${projectConfig.scriptName}: synced env vars for ${trigger.name}`)
		}
	}

	const desiredTriggerNames = new Set(projectConfig.triggers.map((trigger) => trigger.name))

	for (const scriptName of projectConfig.pruneScriptNames) {
		const staleTriggers = await client.listTriggers(scriptName)

		for (const staleTrigger of staleTriggers) {
			if (
				!desiredTriggerNames.has(staleTrigger?.trigger_name) ||
				typeof staleTrigger?.trigger_uuid !== "string"
			) {
				continue
			}

			if (dryRun) {
				console.log(`- ${scriptName}: would delete ${staleTrigger.trigger_name}`)
				continue
			}

			await client.deleteTrigger(staleTrigger.trigger_uuid)
			console.log(`- ${scriptName}: deleted ${staleTrigger.trigger_name}`)
		}
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
