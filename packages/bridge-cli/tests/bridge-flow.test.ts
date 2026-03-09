import { describe, expect, it } from "vitest"
import { runBridgeOperation } from "../src/commands/bridge"

describe("bridge flow", () => {
	it("submits and finalizes a deposit flow", async () => {
		let depositStatusCalls = 0
		const events: string[] = []

		const result = await runBridgeOperation(
			{
				id: "op-1",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62test",
				timeoutSlots: 10
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "submit-hash",
							explorerUrl: "https://minascan.io/devnet/tx/submit-hash",
							included: true
						}
					},
					async getDepositStatuses() {
						depositStatusCalls += 1
						if (depositStatusCalls === 1) {
							return [
								{
									index: 0,
									amount: "2",
									recipient: "B62test",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "submit-hash",
									timestamp: "2026-03-09T19:00:00.000Z"
								}
							]
						}

						return [
							{
								index: 0,
								amount: "2",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "finalize-hash",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					},
					async finalizeDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash: "finalize-hash",
							explorerUrl: "https://zekoscan.io/testnet/tx/finalize-hash",
							included: true
						}
					}
				},
				sessionStore: {
					async save(session) {
						events.push(session.phase)
					}
				},
				log: async ({ event }) => {
					events.push(event)
				},
				sleep: async () => {},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("completed")
		expect(result.finalTransaction?.hash).toBe("finalize-hash")
		expect(events).toContain("submitted")
		expect(events).toContain("finalized")
	})
})
