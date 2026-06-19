import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const testDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(testDir, "..")
const script = readFileSync(resolve(testDir, "../scripts/sync-secrets.nu"), "utf8")
const statusScript = readFileSync(resolve(testDir, "../scripts/status.nu"), "utf8")
const describeInstanceScript = readFileSync(
	resolve(testDir, "../scripts/describe-instance.nu"),
	"utf8"
)
const cleanupScript = readFileSync(resolve(testDir, "../scripts/cleanup.nu"), "utf8")
const startScript = readFileSync(resolve(testDir, "../scripts/start.nu"), "utf8")
const moonConfig = readFileSync(resolve(testDir, "../moon.yml"), "utf8")

const createSecretSyncHarness = async (envLines: string[]) => {
	const root = await mkdtemp(join(tmpdir(), "bridge-validator-secret-sync-"))
	const fakeBin = join(root, "bin")
	const envFile = join(root, ".env")
	const secretLogFile = join(root, "secrets.log")
	const wranglerConfig = join(root, "wrangler.jsonc")
	await mkdir(fakeBin)
	await writeFile(
		join(fakeBin, "pnpm"),
		[
			"#!/usr/bin/env sh",
			"value=$(cat)",
			'if [ -n "$SECRET_SYNC_LOG" ]; then',
			'  printf "%s=%s\\n" "$5" "$value" >> "$SECRET_SYNC_LOG"',
			"fi",
			"exit 0",
			""
		].join("\n"),
		"utf8"
	)
	await chmod(join(fakeBin, "pnpm"), 0o755)
	await writeFile(envFile, envLines.join("\n"), "utf8")
	await writeFile(wranglerConfig, "{}", "utf8")

	return {
		root,
		envFile,
		wranglerConfig,
		fakeBin,
		secretLogFile,
		missingWalletFile: join(root, ".env.wallet.missing")
	}
}

describe("bridge-validator secret sync script", () => {
	it("maps required local values into Cloudflare Worker secrets", () => {
		expect(script).toContain("default-env-file")
		expect(script).toContain("default-wallet-env-file")
		expect(script).toContain("default-wrangler-config")
		expect(script).toContain("MINA_PRIVATE_KEY")
		expect(script).toContain("PUBLIC_KEY")
		expect(script).toContain("BRIDGE_VALIDATOR_WALLET_ENV_FILE")
		expect(script).toContain('put-secret "WALLET_PRIVATE_KEY"')
		expect(script).toContain('put-secret "WALLET_PUBLIC_KEY"')
		expect(script).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(script).toContain('put-secret "VALIDATOR_API_TOKEN"')
		expect(script).toContain('put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REPOSITORY"')
		expect(script).toContain('put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REF"')
		expect(script).toContain('put-optional-secret $values "GITHUB_TOKEN"')
		expect(script.indexOf("read-dotenv $env_file")).toBeLessThan(
			script.indexOf("read-optional-dotenv $wallet_env_file")
		)
	})

	it("fails when an explicit wallet env override points to a missing file", async () => {
		const harness = await createSecretSyncHarness([
			"BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY=legacy-private-key",
			"BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY=legacy-public-key",
			"SLACK_BOT_TOKEN=slack-token",
			"SLACK_CHANNEL_ID=slack-channel",
			"VALIDATOR_API_TOKEN=validator-token"
		])
		try {
			await writeFile(
				harness.envFile,
				[
					`BRIDGE_VALIDATOR_WALLET_ENV_FILE=${harness.missingWalletFile}`,
					"BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY=legacy-private-key",
					"BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY=legacy-public-key",
					"SLACK_BOT_TOKEN=slack-token",
					"SLACK_CHANNEL_ID=slack-channel",
					"VALIDATOR_API_TOKEN=validator-token"
				].join("\n"),
				"utf8"
			)

			await expect(
				execFileAsync("nu", ["scripts/sync-secrets.nu", harness.envFile, harness.wranglerConfig], {
					cwd: projectDir,
					env: {
						...process.env,
						PATH: `${harness.fakeBin}:${process.env.PATH ?? ""}`
					}
				})
			).rejects.toMatchObject({
				stderr: expect.stringContaining("Explicit wallet env file does not exist")
			})
		} finally {
			await rm(harness.root, { recursive: true, force: true })
		}
	})

	it("fails when a shell wallet env override points to a missing file", async () => {
		const harness = await createSecretSyncHarness([
			"BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY=legacy-private-key",
			"BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY=legacy-public-key",
			"SLACK_BOT_TOKEN=slack-token",
			"SLACK_CHANNEL_ID=slack-channel",
			"VALIDATOR_API_TOKEN=validator-token"
		])
		try {
			await expect(
				execFileAsync("nu", ["scripts/sync-secrets.nu", harness.envFile, harness.wranglerConfig], {
					cwd: projectDir,
					env: {
						...process.env,
						BRIDGE_VALIDATOR_WALLET_ENV_FILE: harness.missingWalletFile,
						PATH: `${harness.fakeBin}:${process.env.PATH ?? ""}`
					}
				})
			).rejects.toMatchObject({
				stderr: expect.stringContaining("Explicit wallet env file does not exist")
			})
		} finally {
			await rm(harness.root, { recursive: true, force: true })
		}
	})

	it("resolves dotenv wallet env overrides relative to the dotenv file", async () => {
		const harness = await createSecretSyncHarness([
			"BRIDGE_VALIDATOR_WALLET_ENV_FILE=.env.wallet.validator",
			"BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY=legacy-private-key",
			"BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY=legacy-public-key",
			"SLACK_BOT_TOKEN=slack-token",
			"SLACK_CHANNEL_ID=slack-channel",
			"VALIDATOR_API_TOKEN=validator-token"
		])
		try {
			await writeFile(
				join(harness.root, ".env.wallet.validator"),
				["MINA_PRIVATE_KEY=root-wallet-private-key", "PUBLIC_KEY=root-wallet-public-key"].join(
					"\n"
				),
				"utf8"
			)

			await execFileAsync(
				"nu",
				["scripts/sync-secrets.nu", harness.envFile, harness.wranglerConfig],
				{
					cwd: projectDir,
					env: {
						...process.env,
						SECRET_SYNC_LOG: harness.secretLogFile,
						PATH: `${harness.fakeBin}:${process.env.PATH ?? ""}`
					}
				}
			)

			const syncedSecrets = readFileSync(harness.secretLogFile, "utf8")
			expect(syncedSecrets).toContain("WALLET_PRIVATE_KEY=root-wallet-private-key")
			expect(syncedSecrets).toContain("WALLET_PUBLIC_KEY=root-wallet-public-key")
			expect(syncedSecrets).not.toContain("legacy-private-key")
			expect(syncedSecrets).not.toContain("legacy-public-key")
		} finally {
			await rm(harness.root, { recursive: true, force: true })
		}
	})

	it("fails when a selected wallet env file is missing part of the keypair", async () => {
		const harness = await createSecretSyncHarness([
			"BRIDGE_VALIDATOR_WALLET_ENV_FILE=.env.wallet.validator",
			"BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY=legacy-private-key",
			"BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY=legacy-public-key",
			"SLACK_BOT_TOKEN=slack-token",
			"SLACK_CHANNEL_ID=slack-channel",
			"VALIDATOR_API_TOKEN=validator-token"
		])
		try {
			await writeFile(
				join(harness.root, ".env.wallet.validator"),
				"MINA_PRIVATE_KEY=root-wallet-private-key\n",
				"utf8"
			)

			await expect(
				execFileAsync("nu", ["scripts/sync-secrets.nu", harness.envFile, harness.wranglerConfig], {
					cwd: projectDir,
					env: {
						...process.env,
						SECRET_SYNC_LOG: harness.secretLogFile,
						PATH: `${harness.fakeBin}:${process.env.PATH ?? ""}`
					}
				})
			).rejects.toMatchObject({
				stderr: expect.stringContaining("Missing required wallet value")
			})
		} finally {
			await rm(harness.root, { recursive: true, force: true })
		}
	})

	it("loads the status bearer token from the dotenv file", () => {
		expect(statusScript).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(statusScript).toContain("http get")
		expect(statusScript).toContain("--max-time 20sec")
		expect(statusScript).not.toContain("$env.VALIDATOR_API_TOKEN")
	})

	it("uses Nu scripts for operator workflow diagnostics", () => {
		expect(describeInstanceScript).toContain("VALIDATOR_INSTANCE_ID")
		expect(describeInstanceScript).toContain("wrangler workflows instances describe")
		expect(cleanupScript).toContain("/bridge-cleanup?instanceId=")
		expect(cleanupScript).toContain("http post --max-time 30sec")
		expect(startScript).toContain("/bridge-start")
		expect(startScript).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(moonConfig).toContain("command: nu scripts/describe-instance.nu")
		expect(moonConfig).toContain("command: nu scripts/cleanup.nu")
		expect(moonConfig).toContain("command: nu scripts/start.nu mina-to-zeko")
		expect(moonConfig).toContain("command: nu scripts/start.nu zeko-to-mina")
		expect(moonConfig).not.toContain("bash -lc")
	})
})
