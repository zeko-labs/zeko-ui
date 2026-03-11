import { describe, expect, it } from "vitest"
import { runBridgeOperation } from "../src/commands/bridge"

describe("bridge flow", () => {
	it("advances earlier queued deposit claims before completing the current bridge", async () => {
		let depositStatusCalls = 0
		const finalizeCalls: string[] = []
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-queued",
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
							hash: "submit-current",
							explorerUrl: "https://minascan.io/devnet/tx/submit-current",
							included: true
						}
					},
					async getDepositStatuses() {
						depositStatusCalls += 1
						if (depositStatusCalls === 1) {
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
									hash: "submit-earlier",
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
									finalised: false,
									hash: "submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						if (depositStatusCalls === 2) {
							return [
								{
									index: 0,
									amount: "1",
									recipient: "B62test",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: true,
									hash: "finalize-earlier",
									timestamp: "2026-03-09T19:02:00.000Z"
								},
								{
									index: 1,
									amount: "2",
									recipient: "B62test",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "finalize-earlier",
								timestamp: "2026-03-09T19:02:00.000Z"
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
								hash: "finalize-current",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return true
					},
					async finalizeDeposit() {
						const hash = finalizeCalls.length === 0 ? "finalize-earlier" : "finalize-current"
						finalizeCalls.push(hash)
						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash,
							explorerUrl: `https://zekoscan.io/testnet/tx/${hash}`,
							included: true
						}
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event, details }) => {
					events.push({ event, details })
				},
				sleep: async () => {},
				pollIntervalMs: 0
			}
		)

		expect(finalizeCalls).toEqual(["finalize-earlier", "finalize-current"])
		expect(
			events.some(
				(entry) => entry.event === "waiting-on-prior-claims" && entry.details?.pendingAhead === 1
			)
		).toBe(true)
		expect(result.finalTransaction?.hash).toBe("finalize-current")
		expect(result.status).toBe("completed")
	})

	it("rebinds a persisted target index to the submitted hash when the new operation appears later", async () => {
		let depositStatusCalls = 0

		const result = await runBridgeOperation(
			{
				id: "op-rebind",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
				account: "B62test",
				session: {
					id: "op-rebind",
					status: "running",
					phase: "waiting-finalization",
					route: "mina:testnet->zeko:testnet",
					direction: "deposit",
					account: "B62test",
					recipient: "B62test",
					amount: "1",
					logPath: "/tmp/rebind.jsonl",
					createdAt: "2026-03-10T00:00:00.000Z",
					updatedAt: "2026-03-10T00:00:10.000Z",
					submittedTransactions: [{ action: "submit", hash: "submit-current" }],
					targetIndex: 5
				}
			},
			{
				adapter: {
					async getDepositStatuses() {
						depositStatusCalls += 1
						if (depositStatusCalls === 1) {
							return [
								{
									index: 5,
									amount: "2",
									recipient: "B62other",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "older-pending",
									timestamp: "2026-03-09T19:00:00.000Z"
								},
								{
									index: 7,
									amount: "1",
									recipient: "B62test",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 5,
								amount: "2",
								recipient: "B62other",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "older-finalized",
								timestamp: "2026-03-09T19:02:00.000Z"
							},
							{
								index: 7,
								amount: "1",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "finalize-current",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return true
					},
					async finalizeDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash: "finalize-current",
							explorerUrl: "https://zekoscan.io/testnet/tx/finalize-current",
							included: true
						}
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async () => {},
				sleep: async () => {},
				pollIntervalMs: 0,
				now: () => "2026-03-10T00:00:00.000Z"
			}
		)

		expect(result.targetIndex).toBe(7)
		expect(result.status).toBe("completed")
	})

	it("cancels an older blocking deposit before completing the requested bridge", async () => {
		let depositStatusCalls = 0
		const cancelCalls: string[] = []
		const finalizeCalls: string[] = []
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-prior-cancel",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
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
							hash: "submit-current",
							explorerUrl: "https://minascan.io/devnet/tx/submit-current",
							included: true
						}
					},
					async getDepositStatuses() {
						depositStatusCalls += 1
						if (depositStatusCalls === 1) {
							return [
								{
									index: 4,
									amount: "2",
									recipient: "B62older",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								},
								{
									index: 5,
									amount: "1",
									recipient: "B62test",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: false,
									finalised: false,
									hash: "submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						if (depositStatusCalls === 2) {
							return [
								{
									index: 4,
									amount: "2",
									recipient: "B62older",
									cancelled: true,
									synced: true,
									accepted: true,
									confirmed: false,
									finalised: false,
									hash: "cancel-older",
									timestamp: "2026-03-09T19:02:00.000Z"
								},
								{
									index: 5,
									amount: "1",
									recipient: "B62test",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 4,
								amount: "2",
								recipient: "B62older",
								cancelled: true,
								synced: true,
								accepted: true,
								confirmed: false,
								finalised: false,
								hash: "cancel-older",
								timestamp: "2026-03-09T19:02:00.000Z"
							},
							{
								index: 5,
								amount: "1",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "finalize-current",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return depositStatusCalls >= 2
					},
					async canCancelDeposit() {
						return true
					},
					async cancelDeposit() {
						cancelCalls.push("cancel-older")
						return {
							success: true,
							direction: "deposit",
							action: "cancel",
							route: "mina:testnet->zeko:testnet",
							hash: "cancel-older",
							explorerUrl: "https://minascan.io/devnet/tx/cancel-older",
							included: true
						}
					},
					async finalizeDeposit() {
						finalizeCalls.push("finalize-current")
						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash: "finalize-current",
							explorerUrl: "https://zekoscan.io/testnet/tx/finalize-current",
							included: true
						}
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event, details }) => {
					events.push({ event, details })
				},
				sleep: async () => {},
				pollIntervalMs: 0
			}
		)

		expect(cancelCalls).toEqual(["cancel-older"])
		expect(finalizeCalls).toEqual(["finalize-current"])
		expect(
			events.some(
				(entry) => entry.event === "cancel-submitted" && entry.details?.advancedPriorClaim === true
			)
		).toBe(true)
		expect(result.finalTransaction?.hash).toBe("finalize-current")
		expect(result.status).toBe("completed")
	})

	it("emits low-noise heartbeat progress during long waits", async () => {
		let depositStatusCalls = 0
		let nowIndex = 0
		const times = [
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:30.000Z",
			"2026-03-10T00:01:01.000Z",
			"2026-03-10T00:01:01.000Z",
			"2026-03-10T00:01:01.000Z",
			"2026-03-10T00:01:01.000Z",
			"2026-03-10T00:01:30.000Z",
			"2026-03-10T00:02:02.000Z",
			"2026-03-10T00:02:02.000Z",
			"2026-03-10T00:02:02.000Z"
		]
		const events: string[] = []

		const result = await runBridgeOperation(
			{
				id: "op-heartbeat",
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
						if (depositStatusCalls < 4) {
							return [
								{
									index: 0,
									amount: "2",
									recipient: "B62test",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: false,
									finalised: false,
									hash: "submit-hash",
									timestamp: "2026-03-10T00:00:01.000Z"
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
								timestamp: "2026-03-10T00:02:02.000Z"
							}
						]
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event }) => {
					events.push(event)
				},
				sleep: async () => {},
				pollIntervalMs: 30_000,
				now: () => times[Math.min(nowIndex++, times.length - 1)] ?? times.at(-1) ?? ""
			}
		)

		expect(events.filter((event) => event === "heartbeat")).toHaveLength(2)
		expect(result.status).toBe("completed")
	})

	it("fails a withdrawal when the submitted hash never appears in bridge status", async () => {
		const events: string[] = []
		let nowCalls = 0
		const times = ["2026-03-10T00:00:00.000Z", "2026-03-10T00:00:02.000Z"]

		const result = await runBridgeOperation(
			{
				id: "op-stalled-submission",
				from: "zeko:testnet",
				to: "mina:testnet",
				amount: "1",
				account: "B62test"
			},
			{
				adapter: {
					async submitWithdrawal() {
						return {
							success: true,
							direction: "withdrawal",
							action: "submit",
							route: "zeko:testnet->mina:testnet",
							hash: "withdraw-submit",
							explorerUrl: "https://zekoscan.io/testnet/tx/withdraw-submit",
							included: false
						}
					},
					async getWithdrawalStatuses() {
						return []
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event }) => {
					events.push(event)
				},
				sleep: async () => {},
				pollIntervalMs: 0,
				stalledSubmissionSeconds: 1,
				now: () => times[Math.min(nowCalls++, times.length - 1)] ?? times.at(-1) ?? ""
			}
		)

		expect(result.status).toBe("failed")
		expect(result.lastError).toContain("stale-submission threshold")
		expect(events).toContain("failed")
	})

	it("fails a deposit when older queued claims block progress beyond the threshold", async () => {
		const events: string[] = []
		let nowCalls = 0
		const times = ["2026-03-10T00:00:00.000Z", "2026-03-10T00:00:02.000Z"]

		const result = await runBridgeOperation(
			{
				id: "op-stalled-prior",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
				account: "B62test"
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "deposit-submit",
							explorerUrl: "https://minascan.io/devnet/tx/deposit-submit",
							included: false
						}
					},
					async getDepositStatuses() {
						return [
							{
								index: 1,
								amount: "2",
								recipient: "B62older",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: false,
								hash: "older-submit",
								timestamp: "2026-03-09T19:00:00.000Z"
							},
							{
								index: 2,
								amount: "1",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: false,
								finalised: false,
								hash: "deposit-submit",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event }) => {
					events.push(event)
				},
				sleep: async () => {},
				pollIntervalMs: 0,
				stalledPriorClaimSeconds: 1,
				now: () => times[Math.min(nowCalls++, times.length - 1)] ?? times.at(-1) ?? ""
			}
		)

		expect(result.status).toBe("failed")
		expect(result.lastError).toContain("stale-prior-claim threshold")
		expect(events).toContain("failed")
	})

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
				pollIntervalMs: 0,
				retryDelayMs: 0
			}
		)

		expect(result.status).toBe("completed")
		expect(result.finalTransaction?.hash).toBe("finalize-hash")
		expect(events).toContain("submitted")
		expect(events).toContain("finalized")
	})

	it("retries transient adapter failures instead of aborting the bridge flow", async () => {
		let statusCalls = 0
		const events: string[] = []

		const result = await runBridgeOperation(
			{
				id: "op-retry",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
				account: "B62retry"
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "retry-submit",
							explorerUrl: "https://minascan.io/devnet/tx/retry-submit",
							included: true
						}
					},
					async getDepositStatuses() {
						statusCalls += 1
						if (statusCalls === 1) {
							throw new Error("temporary rpc failure")
						}

						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62retry",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "retry-finalize",
								timestamp: "2026-03-09T19:02:00.000Z"
							}
						]
					},
					async finalizeDeposit() {
						throw new Error("finalizeDeposit should not be called in this test")
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event }) => {
					events.push(event)
				},
				sleep: async () => {},
				pollIntervalMs: 0,
				retryDelayMs: 0
			}
		)

		expect(result.status).toBe("completed")
		expect(statusCalls).toBe(2)
		expect(events).toContain("retrying")
	})

	it("emits heartbeat progress while waiting for confirmation", async () => {
		let statusCalls = 0
		const events: string[] = []

		const result = await runBridgeOperation(
			{
				id: "op-heartbeat",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
				account: "B62heartbeat"
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "heartbeat-submit",
							explorerUrl: "https://minascan.io/devnet/tx/heartbeat-submit",
							included: true
						}
					},
					async getDepositStatuses() {
						statusCalls += 1
						if (statusCalls === 1) {
							return [
								{
									index: 0,
									amount: "1",
									recipient: "B62heartbeat",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: false,
									finalised: false,
									hash: "heartbeat-submit",
									timestamp: "2026-03-09T19:00:00.000Z"
								}
							]
						}

						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62heartbeat",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "heartbeat-finalize",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					},
					async finalizeDeposit() {
						throw new Error("finalizeDeposit should not be called in this test")
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event }) => {
					events.push(event)
				},
				sleep: async () => {},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("completed")
		expect(events).toContain("heartbeat")
	})

	it("advances earlier deposit claims before completing the current bridge", async () => {
		let statusCalls = 0
		let finalizeCalls = 0

		const result = await runBridgeOperation(
			{
				id: "op-queued-deposit",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62queued"
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "deposit-submit-current",
							explorerUrl: "https://minascan.io/devnet/tx/deposit-submit-current",
							included: true
						}
					},
					async getDepositStatuses() {
						statusCalls += 1
						if (statusCalls === 1) {
							return [
								{
									index: 0,
									amount: "1",
									recipient: "B62queued",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "deposit-submit-earlier",
									timestamp: "2026-03-09T19:00:00.000Z"
								},
								{
									index: 1,
									amount: "2",
									recipient: "B62queued",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "deposit-submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}
						if (statusCalls === 2) {
							return [
								{
									index: 0,
									amount: "1",
									recipient: "B62queued",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: true,
									hash: "deposit-finalize-earlier",
									timestamp: "2026-03-09T19:02:00.000Z"
								},
								{
									index: 1,
									amount: "2",
									recipient: "B62queued",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "deposit-submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62queued",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "deposit-finalize-earlier",
								timestamp: "2026-03-09T19:02:00.000Z"
							},
							{
								index: 1,
								amount: "2",
								recipient: "B62queued",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "deposit-finalize-current",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return true
					},
					async finalizeDeposit() {
						finalizeCalls += 1
						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash: finalizeCalls === 1 ? "deposit-finalize-earlier" : "deposit-finalize-current",
							explorerUrl: "https://zekoscan.io/testnet/tx/deposit-finalize-current",
							included: true
						}
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async () => {},
				sleep: async () => {
					throw new Error("bridge flow got stuck waiting instead of advancing queued claims")
				},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("completed")
		expect(finalizeCalls).toBe(2)
		expect(result.finalTransaction?.hash).toBe("deposit-finalize-current")
	})

	it("advances earlier withdrawal claims before completing the current bridge", async () => {
		let statusCalls = 0
		let finalizeCalls = 0

		const result = await runBridgeOperation(
			{
				id: "op-queued-withdrawal",
				from: "zeko:testnet",
				to: "mina:testnet",
				amount: "2",
				account: "B62queued"
			},
			{
				adapter: {
					async submitWithdrawal() {
						return {
							success: true,
							direction: "withdrawal",
							action: "submit",
							route: "zeko:testnet->mina:testnet",
							hash: "withdrawal-submit-current",
							explorerUrl: "https://zekoscan.io/testnet/tx/withdrawal-submit-current",
							included: true
						}
					},
					async getWithdrawalStatuses() {
						statusCalls += 1
						if (statusCalls === 1) {
							return [
								{
									index: 0,
									amount: "1",
									recipient: "B62queued",
									committed: true,
									finalised: false,
									hash: "withdrawal-submit-earlier",
									timestamp: "2026-03-09T19:00:00.000Z"
								},
								{
									index: 1,
									amount: "2",
									recipient: "B62queued",
									committed: true,
									finalised: false,
									hash: "withdrawal-submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}
						if (statusCalls === 2) {
							return [
								{
									index: 0,
									amount: "1",
									recipient: "B62queued",
									committed: true,
									finalised: true,
									hash: "withdrawal-finalize-earlier",
									timestamp: "2026-03-09T19:02:00.000Z"
								},
								{
									index: 1,
									amount: "2",
									recipient: "B62queued",
									committed: true,
									finalised: false,
									hash: "withdrawal-submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62queued",
								committed: true,
								finalised: true,
								hash: "withdrawal-finalize-earlier",
								timestamp: "2026-03-09T19:02:00.000Z"
							},
							{
								index: 1,
								amount: "2",
								recipient: "B62queued",
								committed: true,
								finalised: true,
								hash: "withdrawal-finalize-current",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					},
					async canFinalizeWithdrawal() {
						return true
					},
					async finalizeWithdrawal() {
						finalizeCalls += 1
						return {
							success: true,
							direction: "withdrawal",
							action: "finalize",
							route: "zeko:testnet->mina:testnet",
							hash:
								finalizeCalls === 1 ? "withdrawal-finalize-earlier" : "withdrawal-finalize-current",
							explorerUrl: "https://minascan.io/devnet/tx/withdrawal-finalize-current",
							included: true
						}
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async () => {},
				sleep: async () => {
					throw new Error("bridge flow got stuck waiting instead of advancing queued claims")
				},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("completed")
		expect(finalizeCalls).toBe(2)
		expect(result.finalTransaction?.hash).toBe("withdrawal-finalize-current")
	})
})
