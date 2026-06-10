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
	upsertEnvironmentVariables: vi.fn(async () => ({})),
	...overrides
})

describe("parseArgs", () => {
	it("parses sync options and explicit config paths", () => {
		expect(parseArgs(["sync", "--dry-run", "apps/faucet/workers-build.jsonc"])).toEqual({
			command: "sync",
			dryRun: true,
			paths: ["apps/faucet/workers-build.jsonc"]
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
