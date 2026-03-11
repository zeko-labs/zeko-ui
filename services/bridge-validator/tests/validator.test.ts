import { describe, expect, it } from "vitest"
import { readValidatorEnv } from "../src/config"
import {
	buildBridgeProcessScript,
	buildScheduledValidations,
	DEFAULT_CLI_SPECIFIER,
	parseBridgeJson
} from "../src/validator"

describe("bridge validator", () => {
	it("builds a sandbox script that runs the published high-level bridge command", () => {
		const script = buildBridgeProcessScript({
			routeKey: "mina-to-zeko",
			cliSpecifier: DEFAULT_CLI_SPECIFIER
		})

		expect(script).toContain("npm view @zeko-labs/bridge-cli@latest version")
		expect(script).toContain(
			"npx -y @zeko-labs/bridge-cli@latest bridge --from mina:testnet --to zeko:testnet --amount 1 --json"
		)
		expect(script).toContain("/workspace/bridge-validator/result.json")
		expect(script).toContain("/workspace/bridge-validator/progress.log")
	})

	it("creates exactly two scheduled workflow payloads, one per bridge direction", () => {
		const validations = buildScheduledValidations({
			scheduledTime: 1_762_684_800_000,
			cliSpecifier: DEFAULT_CLI_SPECIFIER
		})

		expect(validations).toEqual([
			expect.objectContaining({
				id: "bridge-validator-mina-to-zeko-1762684800000",
				params: expect.objectContaining({
					routeKey: "mina-to-zeko",
					cliSpecifier: DEFAULT_CLI_SPECIFIER
				})
			}),
			expect.objectContaining({
				id: "bridge-validator-zeko-to-mina-1762684800000",
				params: expect.objectContaining({
					routeKey: "zeko-to-mina",
					cliSpecifier: DEFAULT_CLI_SPECIFIER
				})
			})
		])
	})

	it("requires only bridge keys and slack delivery config", () => {
		expect(
			readValidatorEnv({
				ZEKO_BRIDGE_MINA_PRIVATE_KEY: "mina-key",
				SLACK_BOT_TOKEN: "xoxb-token",
				SLACK_CHANNEL_ID: "C123"
			})
		).toEqual({
			minaPrivateKey: "mina-key",
			zekoPrivateKey: "mina-key",
			slackBotToken: "xoxb-token",
			slackChannelId: "C123"
		})
	})

	it("parses the final bridge json payload", () => {
		expect(
			parseBridgeJson(
				JSON.stringify({
					success: true,
					operation_id: "bridge-op-1",
					route: "mina:testnet->zeko:testnet",
					direction: "deposit",
					status: "completed",
					amount: "1",
					recipient: "B62test",
					submitted_transactions: [{ action: "submit", hash: "hash-1" }],
					final_transaction: { action: "finalize", hash: "hash-2" },
					explorer_urls: [],
					log_path: "/tmp/bridge-op-1.jsonl"
				})
			).operation_id
		).toBe("bridge-op-1")
	})
})
