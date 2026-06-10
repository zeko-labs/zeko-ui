#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const CONFIG_BASENAME = "workers-build.jsonc"
const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url))
const SEARCH_ROOTS = ["apps", "services", "unused"] as const
const SKIP_DIRS = new Set([
	".git",
	".moon",
	".nuxt",
	".output",
	".wrangler",
	"dist",
	"node_modules"
])

type JsonRecord = Record<string, unknown>

type EnvironmentVariableDefinition = {
	secret: boolean
	value: string | null
	valueFromEnv: string | null
}

type DesiredTrigger = {
	name: string
	buildCommand: string
	deployCommand: string
	rootDirectory: string
	branchIncludes: string[]
	branchExcludes: string[]
	pathIncludes: string[]
	pathExcludes: string[]
	environmentVariables: Record<string, EnvironmentVariableDefinition>
}

export type WorkersBuildConfig = {
	configPath: string
	enabled: boolean
	scriptName: string | null
	pruneScriptNames: string[]
	triggers: DesiredTrigger[]
}

type TriggerPayload = {
	trigger_name: string
	build_command: string
	deploy_command: string
	root_directory: string
	branch_includes: string[]
	branch_excludes: string[]
	path_includes: string[]
	path_excludes: string[]
}

type CreateTriggerPayload = TriggerPayload & {
	external_script_id: string
	build_token_uuid: string
	repo_connection_uuid: string
}

type CloudflareApiResult<T> = {
	result: T
	success?: boolean
	errors?: unknown
}

type TriggerBuildPayload = {
	branch: string
	commit_hash?: string
}

export type RemoteTrigger = {
	trigger_uuid?: string
	trigger_name?: string
	build_command?: string
	deploy_command?: string
	root_directory?: string | null
	branch_includes?: unknown
	branch_excludes?: unknown
	path_includes?: unknown
	path_excludes?: unknown
	build_token_uuid?: string
	repo_connection?: {
		repo_connection_uuid?: string
	}
}

export type CloudflareBuildClient = {
	createTrigger: (
		payload: CreateTriggerPayload
	) => Promise<CloudflareApiResult<{ trigger_uuid: string }>>
	deleteTrigger: (triggerUuid: string) => Promise<unknown>
	getExternalScriptId: (scriptName: string) => Promise<string>
	listTriggers: (scriptName: string) => Promise<RemoteTrigger[]>
	patchTrigger: (triggerUuid: string, payload: TriggerPayload) => Promise<unknown>
	triggerBuild: (
		triggerUuid: string,
		payload: TriggerBuildPayload
	) => Promise<CloudflareApiResult<{ build_uuid: string }>>
	upsertEnvironmentVariables: (
		triggerUuid: string,
		payload: Record<string, { is_secret: boolean; value: string }>
	) => Promise<unknown>
}

export type TriggerCreateCredentials = {
	buildTokenUuid: string
	repoConnectionUuid: string
}

export type SyncOptions = {
	dryRun: boolean
	createCredentials?: TriggerCreateCredentials
	triggerBuilds?: boolean
	build?: {
		branch: string
		commitHash?: string
	}
}

export type CliArgs =
	| {
			command: "sync"
			dryRun: boolean
			triggerBuilds: boolean
			paths: string[]
	  }
	| {
			command: "dump-tokens"
			scriptName: string
			triggerName?: string
	  }

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value)

const normalizeList = (value: unknown): unknown[] => {
	if (Array.isArray(value)) {
		return value
	}

	if (isRecord(value) && Array.isArray(value.items)) {
		return value.items
	}

	return value == null ? [] : [value]
}

const normalizeStringArray = (value: unknown) =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const normalizeEnvironmentVariables = (value: unknown, configPath: string) => {
	if (value == null) {
		return {}
	}

	if (!isRecord(value)) {
		throw new Error(`Invalid environmentVariables definition in ${configPath}.`)
	}

	return Object.fromEntries(
		Object.entries(value).map(([name, definition]) => {
			if (!name.trim() || !isRecord(definition)) {
				throw new Error(`Invalid environment variable ${name} in ${configPath}.`)
			}

			const literalValue =
				typeof definition.value === "string" && definition.value.trim() ? definition.value : null
			const valueFromEnv =
				typeof definition.valueFromEnv === "string" && definition.valueFromEnv.trim()
					? definition.valueFromEnv.trim()
					: null

			if (
				(literalValue == null && valueFromEnv == null) ||
				(literalValue != null && valueFromEnv != null)
			) {
				throw new Error(
					`Environment variable ${name} in ${configPath} must define exactly one of value or valueFromEnv.`
				)
			}

			return [
				name,
				{
					secret: definition.secret === true,
					value: literalValue,
					valueFromEnv
				}
			] as const
		})
	)
}

const arraysEqual = (left: string[], right: string[]) =>
	left.length === right.length && left.every((value, index) => value === right[index])

const getRequiredEnv = (name: string) => {
	const value = process.env[name]?.trim()

	if (!value) {
		throw new Error(`${name} is required.`)
	}

	return value
}

const getCreateCredentialsFromEnv = (): TriggerCreateCredentials | undefined => {
	const buildTokenUuid = process.env.CLOUDFLARE_BUILD_TOKEN_UUID?.trim()
	const repoConnectionUuid = process.env.CLOUDFLARE_REPO_CONNECTION_UUID?.trim()

	if (!buildTokenUuid && !repoConnectionUuid) {
		return undefined
	}

	if (!buildTokenUuid) {
		throw new Error("CLOUDFLARE_BUILD_TOKEN_UUID is required to create missing triggers.")
	}

	if (!repoConnectionUuid) {
		throw new Error("CLOUDFLARE_REPO_CONNECTION_UUID is required to create missing triggers.")
	}

	return {
		buildTokenUuid,
		repoConnectionUuid
	}
}

const requireCreateCredentials = (credentials: TriggerCreateCredentials | undefined) => {
	if (!credentials?.buildTokenUuid) {
		throw new Error("CLOUDFLARE_BUILD_TOKEN_UUID is required to create missing triggers.")
	}

	if (!credentials.repoConnectionUuid) {
		throw new Error("CLOUDFLARE_REPO_CONNECTION_UUID is required to create missing triggers.")
	}

	return credentials
}

const branchMatchesPattern = (branch: string, pattern: string) => {
	if (pattern === "*") {
		return true
	}

	return branch === pattern
}

const branchMatchesTrigger = (trigger: DesiredTrigger, branch: string) => {
	const included =
		trigger.branchIncludes.length === 0 ||
		trigger.branchIncludes.some((pattern) => branchMatchesPattern(branch, pattern))
	const excluded = trigger.branchExcludes.some((pattern) => branchMatchesPattern(branch, pattern))

	return included && !excluded
}

const readJsonFile = async (filePath: string): Promise<unknown> => {
	const text = await readFile(filePath, "utf8")
	return JSON.parse(text)
}

export const readWorkersBuildConfig = async (configPath: string): Promise<WorkersBuildConfig> => {
	const config = await readJsonFile(configPath)

	if (!isRecord(config)) {
		throw new Error(`Invalid config file ${configPath}.`)
	}

	if ("triggerTemplateScriptName" in config) {
		throw new Error(
			`triggerTemplateScriptName is no longer supported in ${configPath}; set CLOUDFLARE_BUILD_TOKEN_UUID and CLOUDFLARE_REPO_CONNECTION_UUID instead.`
		)
	}

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
	const pruneScriptNames = normalizeStringArray(config.pruneScriptNames)
	const baseEnvironmentVariables = normalizeEnvironmentVariables(
		config.environmentVariables,
		configPath
	)
	const triggers = normalizeList(config.triggers).map((trigger) => {
		if (
			!isRecord(trigger) ||
			typeof trigger.name !== "string" ||
			typeof trigger.deployCommand !== "string"
		) {
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
		pruneScriptNames,
		triggers
	}
}

export const discoverConfigFiles = async (explicitPaths: string[]) => {
	if (explicitPaths.length > 0) {
		return explicitPaths.map((target) => resolve(WORKSPACE_ROOT, target))
	}

	const found: string[] = []

	const walk = async (directory: string) => {
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

export const createClient = (token: string, accountId: string): CloudflareBuildClient => {
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`

	const request = async <T>(path: string, init: RequestInit = {}) => {
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
		const data = (text ? JSON.parse(text) : {}) as CloudflareApiResult<T>

		if (!response.ok || data.success === false) {
			throw new Error(
				`Cloudflare API request failed for ${path}: ${JSON.stringify(data.errors ?? data, null, 2)}`
			)
		}

		return data
	}

	let scriptsByNamePromise: Promise<Map<string, string>> | null = null

	const getScriptsByName = async () => {
		if (!scriptsByNamePromise) {
			scriptsByNamePromise = request<unknown[]>("/workers/scripts").then((data) => {
				const scripts = new Map<string, string>()

				for (const script of normalizeList(data.result)) {
					if (isRecord(script) && typeof script.id === "string" && typeof script.tag === "string") {
						scripts.set(script.id, script.tag)
					}
				}

				return scripts
			})
		}

		return scriptsByNamePromise
	}

	const getExternalScriptId = async (scriptName: string) => {
		const scriptsByName = await getScriptsByName()
		const externalScriptId = scriptsByName.get(scriptName)

		if (!externalScriptId) {
			throw new Error(`Cloudflare Workers script ${scriptName} was not found.`)
		}

		return externalScriptId
	}

	const listTriggers = async (scriptName: string) => {
		const externalScriptId = await getExternalScriptId(scriptName)
		const data = await request<RemoteTrigger[]>(`/builds/workers/${externalScriptId}/triggers`)
		return normalizeList(data.result).filter(isRecord) as RemoteTrigger[]
	}

	const createTrigger = async (payload: CreateTriggerPayload) =>
		request<{ trigger_uuid: string }>("/builds/triggers", {
			method: "POST",
			body: JSON.stringify(payload)
		})

	const patchTrigger = async (triggerUuid: string, payload: TriggerPayload) =>
		request(`/builds/triggers/${triggerUuid}`, {
			method: "PATCH",
			body: JSON.stringify(payload)
		})

	const triggerBuild = async (triggerUuid: string, payload: TriggerBuildPayload) =>
		request<{ build_uuid: string }>(`/builds/triggers/${triggerUuid}/builds`, {
			method: "POST",
			body: JSON.stringify(payload)
		})

	const deleteTrigger = async (triggerUuid: string) =>
		request(`/builds/triggers/${triggerUuid}`, {
			method: "DELETE"
		})

	const upsertEnvironmentVariables = async (
		triggerUuid: string,
		payload: Record<string, { is_secret: boolean; value: string }>
	) =>
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
		triggerBuild,
		upsertEnvironmentVariables
	}
}

const createDesiredPayload = (trigger: DesiredTrigger): TriggerPayload => ({
	trigger_name: trigger.name,
	build_command: trigger.buildCommand,
	deploy_command: trigger.deployCommand,
	root_directory: trigger.rootDirectory,
	branch_includes: trigger.branchIncludes,
	branch_excludes: trigger.branchExcludes,
	path_includes: trigger.pathIncludes,
	path_excludes: trigger.pathExcludes
})

const createEnvironmentVariablesPayload = (trigger: DesiredTrigger) =>
	Object.fromEntries(
		Object.entries(trigger.environmentVariables).map(([name, definition]) => {
			const value = definition.valueFromEnv
				? getRequiredEnv(definition.valueFromEnv)
				: definition.value

			if (value == null) {
				throw new Error(`Unable to resolve environment variable ${name}.`)
			}

			return [
				name,
				{
					is_secret: definition.secret,
					value
				}
			] as const
		})
	)

const needsUpdate = (existingTrigger: RemoteTrigger, desiredTrigger: TriggerPayload) =>
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

export const syncProject = async (
	client: CloudflareBuildClient,
	projectConfig: WorkersBuildConfig,
	options: SyncOptions
) => {
	if (!projectConfig.scriptName) {
		throw new Error(`Unable to resolve script name for ${projectConfig.configPath}.`)
	}

	const remoteTriggers = await client.listTriggers(projectConfig.scriptName)

	for (const trigger of projectConfig.triggers) {
		const existingTrigger = remoteTriggers.find((remote) => remote.trigger_name === trigger.name)
		const desiredPayload = createDesiredPayload(trigger)
		const environmentVariableNames = Object.keys(trigger.environmentVariables)
		let triggerUuid = existingTrigger?.trigger_uuid

		if (!triggerUuid) {
			if (options.dryRun) {
				console.log(`+ ${projectConfig.scriptName}: would create ${trigger.name}`)
				if (environmentVariableNames.length > 0) {
					console.log(
						`~ ${projectConfig.scriptName}: would sync env vars for ${trigger.name}: ${environmentVariableNames.join(", ")}`
					)
				}
				continue
			}

			const createCredentials = requireCreateCredentials(options.createCredentials)
			const externalScriptId = await client.getExternalScriptId(projectConfig.scriptName)
			const createdTrigger = await client.createTrigger({
				...desiredPayload,
				external_script_id: externalScriptId,
				build_token_uuid: createCredentials.buildTokenUuid,
				repo_connection_uuid: createCredentials.repoConnectionUuid
			})
			triggerUuid = createdTrigger.result.trigger_uuid
			console.log(`+ ${projectConfig.scriptName}: created ${trigger.name}`)
		} else if (existingTrigger && !needsUpdate(existingTrigger, desiredPayload)) {
			console.log(
				`= ${projectConfig.scriptName}: ${trigger.name} already matches ${projectConfig.configPath}`
			)
		} else if (options.dryRun) {
			console.log(`~ ${projectConfig.scriptName}: would update ${trigger.name}`)
			continue
		} else if (existingTrigger) {
			await client.patchTrigger(triggerUuid, desiredPayload)
			console.log(`+ ${projectConfig.scriptName}: updated ${trigger.name}`)
		}

		if (triggerUuid && environmentVariableNames.length > 0) {
			if (options.dryRun) {
				console.log(
					`~ ${projectConfig.scriptName}: would sync env vars for ${trigger.name}: ${environmentVariableNames.join(", ")}`
				)
				continue
			}

			await client.upsertEnvironmentVariables(
				triggerUuid,
				createEnvironmentVariablesPayload(trigger)
			)
			console.log(`+ ${projectConfig.scriptName}: synced env vars for ${trigger.name}`)
		}

		if (
			triggerUuid &&
			options.triggerBuilds === true &&
			!options.dryRun &&
			options.build &&
			branchMatchesTrigger(trigger, options.build.branch)
		) {
			await client.triggerBuild(triggerUuid, {
				branch: options.build.branch,
				...(options.build.commitHash ? { commit_hash: options.build.commitHash } : {})
			})
			console.log(
				`+ ${projectConfig.scriptName}: triggered build for ${trigger.name} on ${options.build.branch}`
			)
		}
	}

	const desiredTriggerNames = new Set(projectConfig.triggers.map((trigger) => trigger.name))

	for (const scriptName of projectConfig.pruneScriptNames) {
		const staleTriggers = await client.listTriggers(scriptName)

		for (const staleTrigger of staleTriggers) {
			if (
				!desiredTriggerNames.has(staleTrigger.trigger_name ?? "") ||
				typeof staleTrigger.trigger_uuid !== "string"
			) {
				continue
			}

			if (options.dryRun) {
				console.log(`- ${scriptName}: would delete ${staleTrigger.trigger_name}`)
				continue
			}

			await client.deleteTrigger(staleTrigger.trigger_uuid)
			console.log(`- ${scriptName}: deleted ${staleTrigger.trigger_name}`)
		}
	}
}

const findTriggerForTokenDump = (triggers: RemoteTrigger[], triggerName: string | undefined) => {
	const trigger = triggers.find((candidate) => {
		const namesMatch = triggerName == null || candidate.trigger_name === triggerName
		return (
			namesMatch &&
			typeof candidate.build_token_uuid === "string" &&
			typeof candidate.repo_connection?.repo_connection_uuid === "string"
		)
	})

	if (!trigger) {
		throw new Error(
			triggerName
				? `Unable to find trigger ${triggerName} with creation UUIDs.`
				: "Unable to find a trigger with creation UUIDs."
		)
	}

	return trigger
}

export const createDumpTokensOutput = (trigger: RemoteTrigger) => {
	const buildTokenUuid = trigger.build_token_uuid
	const repoConnectionUuid = trigger.repo_connection?.repo_connection_uuid

	if (!buildTokenUuid || !repoConnectionUuid) {
		throw new Error("The selected trigger does not expose creation UUIDs.")
	}

	return [
		`export CLOUDFLARE_BUILD_TOKEN_UUID=${buildTokenUuid}`,
		`export CLOUDFLARE_REPO_CONNECTION_UUID=${repoConnectionUuid}`
	].join("\n")
}

const dumpTokens = async (
	client: CloudflareBuildClient,
	scriptName: string,
	triggerName: string | undefined
) => {
	const triggers = await client.listTriggers(scriptName)
	return createDumpTokensOutput(findTriggerForTokenDump(triggers, triggerName))
}

export const parseArgs = (args: string[]): CliArgs => {
	if (args[0] === "dump-tokens") {
		const scriptName = args[1]?.trim()

		if (!scriptName) {
			throw new Error(
				"Usage: zeko-cloudflare-build-config dump-tokens <script-name> [trigger-name]"
			)
		}

		return {
			command: "dump-tokens",
			scriptName,
			triggerName: args[2]?.trim() || undefined
		}
	}

	const syncArgs = args[0] === "sync" ? args.slice(1) : args
	const dryRun = syncArgs.includes("--dry-run")
	const triggerBuilds = syncArgs.includes("--trigger-builds")

	return {
		command: "sync",
		dryRun,
		triggerBuilds,
		paths: syncArgs.filter((arg) => arg !== "--dry-run" && arg !== "--trigger-builds")
	}
}

export const run = async (args: string[]) => {
	const parsedArgs = parseArgs(args)
	const token = getRequiredEnv("CLOUDFLARE_API_TOKEN")
	const accountId = getRequiredEnv("CLOUDFLARE_ACCOUNT_ID")
	const client = createClient(token, accountId)

	if (parsedArgs.command === "dump-tokens") {
		console.log(await dumpTokens(client, parsedArgs.scriptName, parsedArgs.triggerName))
		return
	}

	const configPaths = await discoverConfigFiles(parsedArgs.paths)

	if (configPaths.length === 0) {
		throw new Error(`No ${CONFIG_BASENAME} files were found.`)
	}

	const projectConfigs = await Promise.all(
		configPaths.map((configPath) => readWorkersBuildConfig(configPath))
	)
	const createCredentials = getCreateCredentialsFromEnv()
	const branch = process.env.GITHUB_REF_NAME?.trim()
	const commitHash = process.env.GITHUB_SHA?.trim()

	for (const projectConfig of projectConfigs) {
		if (!projectConfig.enabled) {
			console.log(`- skipped ${projectConfig.configPath}`)
			continue
		}

		await syncProject(client, projectConfig, {
			build: branch
				? {
						branch,
						commitHash: commitHash || undefined
					}
				: undefined,
			createCredentials,
			dryRun: parsedArgs.dryRun,
			triggerBuilds: parsedArgs.triggerBuilds
		})
	}
}

const isMain = () => {
	const entrypoint = process.argv[1]
	return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false
}

if (isMain()) {
	run(process.argv.slice(2)).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	})
}
