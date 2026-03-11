import { describe, expect, it } from "vitest"
import { validatorRoutes } from "../src/routes"
import { buildSlackFailureMessage } from "../src/slack"
import { buildBridgeInvocation, validatePublishedBridge } from "../src/validator"

describe("bridge validator", () => {
	it("runs the published bridge command through the high-level bridge subcommand", async () => {
		const result = await validatePublishedBridge({
			route: validatorRoutes.minaToZeko,
			cliVersion: "0.0.0",
			env: process.env,
			runCommandImpl: async ({ command, args }) => {
				expect(command).toBe("npx")
				expect(args).toEqual([
					"-y",
					"@zeko-labs/bridge-cli@0.0.0",
					"bridge",
					"--from",
					"mina:testnet",
					"--to",
					"zeko:testnet",
					"--amount",
					"1",
					"--json"
				])

				return {
					exitCode: 0,
					stdout: JSON.stringify({
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
					}),
					stderr: ""
				}
			}
		})

		expect(result.result.operation_id).toBe("bridge-op-1")
	})

	it("throws a command-stage failure when the published cli exits non-zero", async () => {
		try {
			await validatePublishedBridge({
				route: validatorRoutes.zekoToMina,
				cliVersion: "0.0.0",
				env: process.env,
				runCommandImpl: async () => ({
					exitCode: 1,
					stdout: "",
					stderr: "bridge failed"
				})
			})
			throw new Error("expected validatePublishedBridge to throw")
		} catch (error) {
			expect(error).toMatchObject({
				stage: "command",
				exitCode: 1,
				stderr: "bridge failed"
			})
		}
	})

	it("formats a compact slack failure message", () => {
		expect(
			buildSlackFailureMessage({
				route: validatorRoutes.minaToZeko,
				cliVersion: "0.0.0",
				stage: "command",
				exitCode: 1,
				stdout: "stdout text",
				stderr: "stderr text",
				message: "Bridge command exited with 1"
			})
		).toContain("Route: mina:testnet->zeko:testnet")
		expect(
			buildBridgeInvocation({ route: validatorRoutes.zekoToMina, cliVersion: "0.0.0" }).args
		).toContain("bridge")
	})
})
