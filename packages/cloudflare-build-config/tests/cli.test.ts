import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
	type CloudflareBuildClient,
	createDumpTokensOutput,
	parseArgs,
	readWorkersBuildConfig,
	syncProject
} from "../src/cli.ts"

const createConfigFile = async (contents: unknown) => {
	const directory = await mkdtemp(join(tmpdir(), "zeko-cloudflare-build-config-"))
	const filePath = join(directory, "workers-build.jsonc")
	await writeFile(filePath, JSON.stringify(contents), "utf8")
	return filePath
}

const createClient = (overrides: Partial<CloudflareBuildClient> = {}): CloudflareBuildClient => ({
	createTrigger: vi.fn(async () => ({ result: { trigger_uuid: "created-trigger" } })),
	deleteTrigger: vi.fn(async () => ({})),
	getExternalScriptId: vi.fn(async () => "script-external-id"),
	listTriggers: vi.fn(async () => []),
	patchTrigger: vi.fn(async () => ({})),
	triggerBuild: vi.fn(async () => ({ result: { build_uuid: "build-uuid" } })),
	upsertEnvironmentVariables: vi.fn(async () => ({})),
	...overrides
})

describe("parseArgs", () => {
	it("parses sync options and explicit config paths", () => {
		expect(parseArgs(["sync", "--dry-run", "apps/faucet/workers-build.jsonc"])).toEqual({
			command: "sync",
			dryRun: true,
			paths: ["apps/faucet/workers-build.jsonc"],
			triggerBuilds: false
		})
	})

	it("parses sync build triggering separately from paths", () => {
		expect(parseArgs(["sync", "apps/faucet/workers-build.jsonc", "--trigger-builds"])).toEqual({
			command: "sync",
			dryRun: false,
			paths: ["apps/faucet/workers-build.jsonc"],
			triggerBuilds: true
		})
	})

	it("parses the dump-tokens command", () => {
		expect(parseArgs(["dump-tokens", "actions-api", "main"])).toEqual({
			command: "dump-tokens",
			scriptName: "actions-api",
			triggerName: "main"
		})
	})
})

describe("readWorkersBuildConfig", () => {
	it("rejects legacy trigger templates", async () => {
		const filePath = await createConfigFile({
			scriptName: "actions-api-testnet",
			triggerTemplateScriptName: "actions-api",
			triggers: [
				{
					name: "main",
					deployCommand: "pnpm deploy"
				}
			]
		})

		await expect(readWorkersBuildConfig(filePath)).rejects.toThrow(
			"triggerTemplateScriptName is no longer supported"
		)
	})
})

describe("syncProject", () => {
	it("requires operator-provided trigger creation UUIDs when a trigger is missing", async () => {
		const client = createClient()
		const config = await readWorkersBuildConfig(
			await createConfigFile({
				scriptName: "actions-api-testnet",
				triggers: [
					{
						name: "main",
						deployCommand: "pnpm deploy"
					}
				]
			})
		)

		await expect(syncProject(client, config, { dryRun: false })).rejects.toThrow(
			"CLOUDFLARE_BUILD_TOKEN_UUID is required to create missing triggers"
		)
		expect(client.createTrigger).not.toHaveBeenCalled()
		expect(client.listTriggers).toHaveBeenCalledTimes(1)
	})

	it("creates missing triggers with operator-provided UUIDs", async () => {
		const client = createClient()
		const config = await readWorkersBuildConfig(
			await createConfigFile({
				scriptName: "actions-api-testnet",
				triggers: [
					{
						name: "main",
						deployCommand: "pnpm deploy"
					}
				]
			})
		)

		await syncProject(client, config, {
			createCredentials: {
				buildTokenUuid: "build-token-uuid",
				repoConnectionUuid: "repo-connection-uuid"
			},
			dryRun: false
		})

		expect(client.createTrigger).toHaveBeenCalledWith({
			branch_excludes: [],
			branch_includes: [],
			build_command: "",
			build_token_uuid: "build-token-uuid",
			deploy_command: "pnpm deploy",
			external_script_id: "script-external-id",
			path_excludes: [],
			path_includes: [],
			repo_connection_uuid: "repo-connection-uuid",
			root_directory: "",
			trigger_name: "main"
		})
	})

	it("triggers matching builds after syncing when requested", async () => {
		const client = createClient({
			listTriggers: vi.fn(async () => [
				{
					trigger_uuid: "main-trigger",
					trigger_name: "main",
					build_command: "",
					deploy_command: "pnpm deploy",
					root_directory: "",
					branch_includes: ["main"],
					branch_excludes: [],
					path_includes: [],
					path_excludes: []
				},
				{
					trigger_uuid: "preview-trigger",
					trigger_name: "preview",
					build_command: "",
					deploy_command: "pnpm deploy-preview",
					root_directory: "",
					branch_includes: ["*"],
					branch_excludes: ["main"],
					path_includes: [],
					path_excludes: []
				}
			])
		})
		const config = await readWorkersBuildConfig(
			await createConfigFile({
				scriptName: "actions-api-testnet",
				triggers: [
					{
						name: "main",
						deployCommand: "pnpm deploy",
						branchIncludes: ["main"]
					},
					{
						name: "preview",
						deployCommand: "pnpm deploy-preview",
						branchIncludes: ["*"],
						branchExcludes: ["main"]
					}
				]
			})
		)

		await syncProject(client, config, {
			build: {
				branch: "main",
				commitHash: "abc123"
			},
			dryRun: false,
			triggerBuilds: true
		})

		expect(client.triggerBuild).toHaveBeenCalledTimes(1)
		expect(client.triggerBuild).toHaveBeenCalledWith("main-trigger", {
			branch: "main",
			commit_hash: "abc123"
		})
	})

	it("does not trigger builds during dry-run syncs", async () => {
		const client = createClient({
			listTriggers: vi.fn(async () => [
				{
					trigger_uuid: "main-trigger",
					trigger_name: "main",
					build_command: "",
					deploy_command: "pnpm deploy",
					root_directory: "",
					branch_includes: ["main"],
					branch_excludes: [],
					path_includes: [],
					path_excludes: []
				}
			])
		})
		const config = await readWorkersBuildConfig(
			await createConfigFile({
				scriptName: "actions-api-testnet",
				triggers: [
					{
						name: "main",
						deployCommand: "pnpm deploy",
						branchIncludes: ["main"]
					}
				]
			})
		)

		await syncProject(client, config, {
			build: {
				branch: "main",
				commitHash: "abc123"
			},
			dryRun: true,
			triggerBuilds: true
		})

		expect(client.triggerBuild).not.toHaveBeenCalled()
	})
})

describe("createDumpTokensOutput", () => {
	it("prints shell exports for a trigger's creation UUIDs", () => {
		expect(
			createDumpTokensOutput({
				build_token_uuid: "build-token-uuid",
				repo_connection: {
					repo_connection_uuid: "repo-connection-uuid"
				}
			})
		).toBe(
			[
				"export CLOUDFLARE_BUILD_TOKEN_UUID=build-token-uuid",
				"export CLOUDFLARE_REPO_CONNECTION_UUID=repo-connection-uuid"
			].join("\n")
		)
	})
})
