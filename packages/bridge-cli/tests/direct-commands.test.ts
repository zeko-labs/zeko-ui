import { describe, expect, it } from "vitest"
import { runDepositStatus, runWithdrawalStatus } from "../src/commands/direct"

describe("direct commands", () => {
	it("returns the latest deposit when latest is requested", async () => {
		const result = await runDepositStatus(
			{
				account: "B62test",
				from: "mina:testnet",
				to: "zeko:testnet",
				latest: true
			},
			{
				adapter: {
					async getDepositStatuses() {
						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: false,
								hash: "hash-0",
								timestamp: "2026-03-09T19:00:00.000Z"
							},
							{
								index: 1,
								amount: "2",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "hash-1",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					}
				}
			}
		)

		expect(result.direction).toBe("deposit")
		expect(result.count).toBe(1)
		expect(result.operations[0]?.index).toBe(1)
	})

	it("returns all withdrawals when latest is disabled", async () => {
		const result = await runWithdrawalStatus(
			{
				account: "B62test",
				from: "zeko:testnet",
				to: "mina:testnet",
				latest: false
			},
			{
				adapter: {
					async getWithdrawalStatuses() {
						return [
							{
								index: 0,
								amount: "3",
								recipient: "B62test",
								committed: true,
								finalised: false,
								hash: "hash-0",
								timestamp: "2026-03-09T19:02:00.000Z"
							},
							{
								index: 1,
								amount: "5",
								recipient: "B62test",
								committed: true,
								finalised: true,
								hash: "hash-1",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					}
				}
			}
		)

		expect(result.direction).toBe("withdrawal")
		expect(result.count).toBe(2)
		expect(result.operations.map((item) => item.index)).toEqual([0, 1])
	})
})
