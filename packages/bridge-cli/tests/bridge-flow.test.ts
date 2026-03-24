import { describe, expect, it } from "vitest"
import { runBridgeOperation } from "../src/commands/bridge"

describe("bridge flow", () => {
	it("drains older queued deposits before the new submission appears in status", async () => {
		let depositStatusCalls = 0
		let nowCalls = 0
		const finalizeCalls: string[] = []
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []
		const times = [
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:01.000Z",
			"2026-03-10T00:00:01.000Z"
		]

		const result = await runBridgeOperation(
			{
				id: "op-drain-before-submit-visible",
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

						if (finalizeCalls.length === 0) {
							return [
								{
									index: 4,
									amount: "1",
									recipient: "B62older",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								}
							]
						}

						if (finalizeCalls.length === 1) {
							return [
								{
									index: 4,
									amount: "1",
									recipient: "B62older",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: true,
									hash: "finalize-older",
									timestamp: "2026-03-09T19:00:30.000Z"
								},
								{
									index: 5,
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
								index: 4,
								amount: "1",
								recipient: "B62older",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "finalize-older",
								timestamp: "2026-03-09T19:00:30.000Z"
							},
							{
								index: 5,
								amount: "2",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "finalize-current",
								timestamp: "2026-03-09T19:01:30.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return true
					},
					async finalizeDeposit() {
						const hash = finalizeCalls.length === 0 ? "finalize-older" : "finalize-current"
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
				pollIntervalMs: 0,
				now: () => times[Math.min(nowCalls++, times.length - 1)] ?? times.at(-1) ?? ""
			}
		)

		expect(depositStatusCalls).toBeGreaterThanOrEqual(2)
		expect(finalizeCalls).toEqual(["finalize-older", "finalize-current"])
		expect(
			events.some(
				(entry) => entry.event === "finalized" && entry.details?.advancedPriorClaim === true
			)
		).toBe(true)
		expect(result.status).toBe("completed")
	})

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
				pollIntervalMs: 0,
				now: () => "2026-03-09T19:30:00.000Z"
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

	it("retries recoverable deposit finalization proof failures before completing", async () => {
		let depositStatusCalls = 0
		let finalizeAttempts = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-finalize-retry",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
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
							hash: "deposit-submit-retry",
							explorerUrl: "https://minascan.io/devnet/tx/deposit-submit-retry",
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
									recipient: "B62retry",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "deposit-submit-retry",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 0,
								amount: "2",
								recipient: "B62retry",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "deposit-finalize-retry",
								timestamp: "2026-03-09T19:02:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return true
					},
					async finalizeDeposit() {
						finalizeAttempts += 1
						if (finalizeAttempts === 1) {
							throw new Error("Failed to fetch proved forest")
						}

						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash: "deposit-finalize-retry",
							explorerUrl: "https://zekoscan.io/testnet/tx/deposit-finalize-retry",
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
				pollIntervalMs: 0,
				now: () => "2026-03-09T19:30:00.000Z"
			}
		)

		expect(result.status).toBe("completed")
		expect(finalizeAttempts).toBe(2)
		expect(
			events.some(
				(entry) =>
					entry.event === "retrying" &&
					entry.details?.operation === "finalizeDeposit" &&
					entry.details?.message === "Failed to fetch proved forest"
			)
		).toBe(true)
	})

	it("treats invalid key as a terminal deposit finalization failure", async () => {
		let finalizeAttempts = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-deposit-invalid-key",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62invalid"
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "deposit-submit-invalid-key",
							explorerUrl: "https://minascan.io/devnet/tx/deposit-submit-invalid-key",
							included: true
						}
					},
					async getDepositStatuses() {
						return [
							{
								index: 0,
								amount: "2",
								recipient: "B62invalid",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: false,
								hash: "deposit-submit-invalid-key",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return true
					},
					async finalizeDeposit() {
						finalizeAttempts += 1
						throw new Error("[GraphQL] Invalid key")
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

		expect(result.status).toBe("failed")
		expect(result.lastError).toBe("[GraphQL] Invalid key")
		expect(finalizeAttempts).toBe(1)
		expect(events.some((entry) => entry.event === "retrying")).toBe(false)
	})

	it("keeps waiting when a queued deposit looks claimable before witnesses are ready", async () => {
		let depositStatusCalls = 0
		let finalizeAttempts = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-deposit-claim-pending",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
				account: "B62claim"
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
							included: false
						}
					},
					async getDepositStatuses() {
						depositStatusCalls += 1

						if (depositStatusCalls === 1) {
							return [
								{
									index: 4,
									amount: "2",
									recipient: "B62claim",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "deposit-submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								}
							]
						}

						if (depositStatusCalls === 2) {
							return [
								{
									index: 4,
									amount: "2",
									recipient: "B62claim",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "deposit-submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								},
								{
									index: 5,
									amount: "1",
									recipient: "B62claim",
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
								index: 4,
								amount: "2",
								recipient: "B62claim",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "deposit-finalize-older",
								timestamp: "2026-03-09T19:02:00.000Z"
							},
							{
								index: 5,
								amount: "1",
								recipient: "B62claim",
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
						finalizeAttempts += 1
						if (finalizeAttempts === 1) {
							throw new Error("Did not find any deposit to finalize")
						}

						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash: "deposit-finalize-current",
							explorerUrl: "https://zekoscan.io/testnet/tx/deposit-finalize-current",
							included: false
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
				pollIntervalMs: 0,
				now: () => "2026-03-09T19:30:00.000Z"
			}
		)

		expect(result.status).toBe("completed")
		expect(finalizeAttempts).toBe(2)
		expect(
			events.some(
				(entry) =>
					entry.event === "claim-pending" &&
					entry.details?.message === "Did not find any deposit to finalize"
			)
		).toBe(true)
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

	it("cancels an older skippable deposit before completing the requested bridge", async () => {
		let depositStatusCalls = 0
		let finalizeAttempts = 0
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
									cancellable: true,
									synced: true,
									accepted: false,
									confirmed: false,
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
									cancellable: false,
									synced: true,
									accepted: false,
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

						if (depositStatusCalls === 3) {
							return [
								{
									index: 4,
									amount: "2",
									recipient: "B62older",
									cancelled: true,
									cancellable: false,
									synced: true,
									accepted: false,
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
								cancellable: false,
								synced: true,
								accepted: false,
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
						finalizeAttempts += 1
						if (finalizeAttempts === 1) {
							throw new Error("Did not find any deposit to finalize")
						}

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

	it("prefers canceling an older skippable deposit before finalizing a later claimable target", async () => {
		let depositStatusCalls = 0
		const calls: string[] = []

		const result = await runBridgeOperation(
			{
				id: "op-cancel-before-finalize",
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
									cancellable: true,
									synced: true,
									accepted: false,
									confirmed: false,
									finalised: false,
									hash: "submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								},
								{
									index: 5,
									amount: "1",
									recipient: "B62test",
									cancelled: false,
									cancellable: false,
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
									index: 4,
									amount: "2",
									recipient: "B62older",
									cancelled: true,
									cancellable: false,
									synced: true,
									accepted: false,
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
									cancellable: false,
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
								cancellable: false,
								synced: true,
								accepted: false,
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
								cancellable: false,
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
					async canCancelDeposit() {
						return true
					},
					async cancelDeposit() {
						calls.push("cancel")
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
						calls.push("finalize")
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
				pollIntervalMs: 0
			}
		)

		expect(calls).toEqual(["cancel", "finalize"])
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

	it("waits across long withdrawal submission delays without failing", async () => {
		const events: string[] = []
		let nowCalls = 0
		let withdrawalStatusCalls = 0
		const times = [
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T03:00:00.000Z",
			"2026-03-10T03:00:00.000Z",
			"2026-03-10T03:00:01.000Z"
		]

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
						withdrawalStatusCalls += 1

						if (withdrawalStatusCalls === 1) {
							return []
						}

						if (withdrawalStatusCalls === 2) {
							return [
								{
									index: 4,
									amount: "1",
									recipient: "B62test",
									committed: false,
									finalised: false,
									hash: "withdraw-submit",
									timestamp: "2026-03-10T03:00:00.000Z"
								}
							]
						}

						return [
							{
								index: 4,
								amount: "1",
								recipient: "B62test",
								committed: true,
								finalised: true,
								hash: "withdraw-finalize",
								timestamp: "2026-03-10T03:00:01.000Z"
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
				now: () => times[Math.min(nowCalls++, times.length - 1)] ?? times.at(-1) ?? ""
			}
		)

		expect(result.status).toBe("completed")
		expect(events).not.toContain("failed")
	})

	it("drains older queued withdrawals before the new submission appears in status", async () => {
		let withdrawalStatusCalls = 0
		let nowCalls = 0
		const finalizeCalls: string[] = []
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []
		const times = [
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T00:00:01.000Z",
			"2026-03-10T00:00:01.000Z"
		]

		const result = await runBridgeOperation(
			{
				id: "op-drain-withdrawals-before-submit-visible",
				from: "zeko:testnet",
				to: "mina:testnet",
				amount: "2",
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
							hash: "withdraw-submit-current",
							explorerUrl: "https://zekoscan.io/testnet/tx/withdraw-submit-current",
							included: true
						}
					},
					async getWithdrawalStatuses() {
						withdrawalStatusCalls += 1

						if (finalizeCalls.length === 0) {
							return [
								{
									index: 8,
									amount: "1",
									recipient: "B62older",
									committed: true,
									finalised: false,
									hash: "withdraw-submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								}
							]
						}

						if (finalizeCalls.length === 1) {
							return [
								{
									index: 8,
									amount: "1",
									recipient: "B62older",
									committed: true,
									finalised: true,
									hash: "withdraw-finalize-older",
									timestamp: "2026-03-09T19:00:30.000Z"
								},
								{
									index: 9,
									amount: "2",
									recipient: "B62test",
									committed: true,
									finalised: false,
									hash: "withdraw-submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 8,
								amount: "1",
								recipient: "B62older",
								committed: true,
								finalised: true,
								hash: "withdraw-finalize-older",
								timestamp: "2026-03-09T19:00:30.000Z"
							},
							{
								index: 9,
								amount: "2",
								recipient: "B62test",
								committed: true,
								finalised: true,
								hash: "withdraw-finalize-current",
								timestamp: "2026-03-09T19:01:30.000Z"
							}
						]
					},
					async canFinalizeWithdrawal() {
						return true
					},
					async finalizeWithdrawal() {
						const hash =
							finalizeCalls.length === 0 ? "withdraw-finalize-older" : "withdraw-finalize-current"
						finalizeCalls.push(hash)
						return {
							success: true,
							direction: "withdrawal",
							action: "finalize",
							route: "zeko:testnet->mina:testnet",
							hash,
							explorerUrl: `https://minascan.io/devnet/tx/${hash}`,
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
				pollIntervalMs: 0,
				now: () => times[Math.min(nowCalls++, times.length - 1)] ?? times.at(-1) ?? ""
			}
		)

		expect(withdrawalStatusCalls).toBeGreaterThanOrEqual(2)
		expect(finalizeCalls).toEqual(["withdraw-finalize-older", "withdraw-finalize-current"])
		expect(
			events.some(
				(entry) => entry.event === "finalized" && entry.details?.advancedPriorClaim === true
			)
		).toBe(true)
		expect(result.status).toBe("completed")
	})

	it("waits across long queued deposit delays without failing", async () => {
		const events: string[] = []
		let nowCalls = 0
		let depositStatusCalls = 0
		const times = [
			"2026-03-10T00:00:00.000Z",
			"2026-03-10T03:00:00.000Z",
			"2026-03-10T03:00:00.000Z",
			"2026-03-10T03:00:01.000Z"
		]

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
						depositStatusCalls += 1

						if (depositStatusCalls === 1) {
							return [
								{
									index: 1,
									amount: "2",
									recipient: "B62older",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: false,
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

						if (depositStatusCalls === 2) {
							return [
								{
									index: 1,
									amount: "2",
									recipient: "B62older",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: true,
									hash: "older-finalized",
									timestamp: "2026-03-10T03:00:00.000Z"
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

						return [
							{
								index: 1,
								amount: "2",
								recipient: "B62older",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "older-finalized",
								timestamp: "2026-03-10T03:00:00.000Z"
							},
							{
								index: 2,
								amount: "1",
								recipient: "B62test",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "deposit-finalized",
								timestamp: "2026-03-10T03:00:01.000Z"
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
				now: () => times[Math.min(nowCalls++, times.length - 1)] ?? times.at(-1) ?? ""
			}
		)

		expect(result.status).toBe("completed")
		expect(events).toContain("waiting-on-prior-claims")
		expect(events).not.toContain("failed")
	})

	it("submits and finalizes a deposit flow", async () => {
		let depositStatusCalls = 0
		const events: string[] = []
		const waits: boolean[] = []

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
					async submitDeposit({ wait }) {
						waits.push(wait)
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
					async canFinalizeDeposit() {
						return true
					},
					async finalizeDeposit({ wait }) {
						waits.push(wait)
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
				retryDelayMs: 0,
				now: () => "2026-03-09T19:20:00.000Z"
			}
		)

		expect(result.status).toBe("completed")
		expect(result.finalTransaction?.hash).toBe("finalize-hash")
		expect(waits).toEqual([false, false])
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
				pollIntervalMs: 0,
				now: () => "2026-03-09T19:00:30.000Z"
			}
		)

		expect(result.status).toBe("completed")
		expect(events).toContain("heartbeat")
	})

	it("captures verbose sdk timings and capability reasons during long waits", async () => {
		let statusCalls = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []
		const result = await runBridgeOperation(
			{
				id: "op-verbose-diagnostics",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
				account: "B62verbose"
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "verbose-submit",
							explorerUrl: "https://minascan.io/devnet/tx/verbose-submit",
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
									recipient: "B62verbose",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "verbose-submit",
									timestamp: "2026-03-09T19:00:00.000Z"
								}
							]
						}

						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62verbose",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: true,
								hash: "verbose-finalize",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return {
							available: false,
							reason: "No deposit witnesses found"
						}
					},
					async canCancelDeposit() {
						return {
							available: false,
							reason: "Not rejected or accepted"
						}
					},
					async finalizeDeposit() {
						throw new Error("finalizeDeposit should not be called in this test")
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event, details }) => {
					events.push({ event, details })
				},
				sleep: async () => {},
				pollIntervalMs: 0,
				now: () => "2026-03-09T19:00:30.000Z",
				verbose: true
			}
		)

		expect(result.status).toBe("completed")
		expect(result.verboseDiagnostics?.sdkMethodStats.getDepositStatuses?.count).toBe(2)
		expect(result.verboseDiagnostics?.sdkMethodStats.canFinalizeDeposit?.count).toBe(1)
		expect(result.verboseDiagnostics?.waitReasons?.canFinalizeDeposit).toEqual({
			available: false,
			reason: "No deposit witnesses found"
		})
		expect(
			events.some(
				(entry) =>
					entry.event === "heartbeat" &&
					entry.details?.finalizeReason === "No deposit witnesses found"
			)
		).toBe(true)
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

	it("retries recoverable withdrawal submission proof failures before continuing", async () => {
		let submitAttempts = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-withdrawal-submit-retry",
				from: "zeko:testnet",
				to: "mina:testnet",
				amount: "3",
				account: "B62submitretry"
			},
			{
				adapter: {
					async submitWithdrawal() {
						submitAttempts += 1
						if (submitAttempts === 1) {
							throw new Error("Failed to fetch proved forest")
						}

						return {
							success: true,
							direction: "withdrawal",
							action: "submit",
							route: "zeko:testnet->mina:testnet",
							hash: "withdrawal-submit-retry",
							explorerUrl: "https://zekoscan.io/testnet/tx/withdrawal-submit-retry",
							included: true
						}
					},
					async getWithdrawalStatuses() {
						return [
							{
								index: 0,
								amount: "3",
								recipient: "B62submitretry",
								committed: true,
								finalised: true,
								hash: "withdrawal-finalize-retry",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					},
					async canFinalizeWithdrawal() {
						return true
					},
					async finalizeWithdrawal() {
						return {
							success: true,
							direction: "withdrawal",
							action: "finalize",
							route: "zeko:testnet->mina:testnet",
							hash: "withdrawal-finalize-retry",
							explorerUrl: "https://minascan.io/devnet/tx/withdrawal-finalize-retry",
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

		expect(result.status).toBe("completed")
		expect(submitAttempts).toBe(2)
		expect(
			events.some(
				(entry) =>
					entry.event === "retrying" &&
					entry.details?.operation === "submitWithdrawal" &&
					entry.details?.message === "Failed to fetch proved forest"
			)
		).toBe(true)
	})

	it("fails clearly during withdrawal submission on a terminal first-withdrawal amount error", async () => {
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []
		const errorMessage =
			"First Zeko->Mina withdrawal amount is too small: recipient B62submitretry does not have an L1 helper account yet, so the first withdrawal must be at least 1 MINA to cover the Mina account creation fee. This withdrawal is 0.2 MINA and cannot proceed as submitted."
		let inspected = false

		const result = await runBridgeOperation(
			{
				id: "op-withdrawal-too-small",
				from: "zeko:testnet",
				to: "mina:testnet",
				amount: "0.2",
				account: "B62submitretry"
			},
			{
				adapter: {
					async submitWithdrawal() {
						throw new Error(errorMessage)
					},
					async getWithdrawalStatuses() {
						inspected = true
						return []
					},
					async canFinalizeWithdrawal() {
						throw new Error("canFinalizeWithdrawal should not be called")
					},
					async finalizeWithdrawal() {
						throw new Error("finalizeWithdrawal should not be called")
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event, details }) => {
					events.push({ event, details })
				},
				sleep: async () => {
					throw new Error("terminal withdrawal amount error should not be retried")
				},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("failed")
		expect(result.lastError).toBe(errorMessage)
		expect(events.some((entry) => entry.event === "retrying")).toBe(false)
		expect(inspected).toBe(false)
	})

	it("stops immediately when submission fails instead of falling through to inspect", async () => {
		let inspected = false

		const result = await runBridgeOperation(
			{
				id: "op-submit-failure",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "1",
				account: "B62submitfail"
			},
			{
				adapter: {
					async submitDeposit() {
						throw new Error("submit exploded")
					},
					async getDepositStatuses() {
						inspected = true
						return []
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async () => {},
				sleep: async () => {},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("failed")
		expect(result.lastError).toBe("submit exploded")
		expect(inspected).toBe(false)
	})

	it("cancels the current deposit when finalize stays unavailable but the SDK marks it cancelable", async () => {
		let statusCalls = 0
		let finalizeCalls = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-current-deposit-cancel",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62cancel"
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
							included: false
						}
					},
					async getDepositStatuses() {
						statusCalls += 1
						if (statusCalls === 1) {
							return [
								{
									index: 12,
									amount: "2",
									recipient: "B62cancel",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "submit-current",
									timestamp: "2026-03-10T12:00:00.000Z"
								}
							]
						}

						return [
							{
								index: 12,
								amount: "2",
								recipient: "B62cancel",
								cancelled: true,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: false,
								hash: "cancel-current",
								timestamp: "2026-03-10T12:05:00.000Z"
							}
						]
					},
					async finalizeDeposit() {
						finalizeCalls += 1
						throw new Error("Did not find any deposit to finalize")
					},
					async canCancelDeposit() {
						return true
					},
					async cancelDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "cancel",
							route: "mina:testnet->zeko:testnet",
							hash: "cancel-current",
							explorerUrl: "https://minascan.io/devnet/tx/cancel-current",
							included: false
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

		expect(result.status).toBe("cancelled")
		expect(result.finalTransaction?.hash).toBe("cancel-current")
		expect(finalizeCalls).toBe(0)
		expect(
			events.some(
				(entry) => entry.event === "cancel-submitted" && entry.details?.hash === "cancel-current"
			)
		).toBe(true)
		expect(events.some((entry) => entry.event === "claim-pending")).toBe(false)
	})

	it("keeps waiting when deposit cannot yet finalize or cancel", async () => {
		let statusCalls = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []
		let sleepCalls = 0

		const result = await runBridgeOperation(
			{
				id: "op-waits-without-cancel-ready",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62timeout",
				timeoutSlots: 480
			},
			{
				adapter: {
					async submitDeposit() {
						return {
							success: true,
							direction: "deposit",
							action: "submit",
							route: "mina:testnet->zeko:testnet",
							hash: "submit-pending",
							explorerUrl: "https://minascan.io/devnet/tx/submit-pending",
							included: false
						}
					},
					async getDepositStatuses() {
						statusCalls += 1
						return [
							{
								index: 3,
								amount: "2",
								recipient: "B62timeout",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: false,
								hash: "submit-pending",
								timestamp: "2026-03-10T00:00:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return false
					},
					async canCancelDeposit() {
						return false
					},
					async cancelDeposit() {
						throw new Error("cancelDeposit should not be called")
					},
					async finalizeDeposit() {
						throw new Error("finalizeDeposit should not be called")
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async ({ event, details }) => {
					events.push({ event, details })
				},
				sleep: async () => {
					sleepCalls += 1
					if (sleepCalls >= 1) {
						throw new Error("stop-after-first-sleep")
					}
				},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("failed")
		expect(result.lastError).toBe("stop-after-first-sleep")
		expect(statusCalls).toBe(1)
		expect(events.some((entry) => entry.event === "cancel-submitted")).toBe(false)
		expect(events.some((entry) => entry.event === "heartbeat")).toBe(true)
	})

	it("does not resubmit the same prior skippable cancellation while the first cancel is still pending", async () => {
		let statusCalls = 0
		const cancelCalls: string[] = []

		const result = await runBridgeOperation(
			{
				id: "op-avoid-duplicate-cancel",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62cancel"
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
							included: false
						}
					},
					async getDepositStatuses() {
						statusCalls += 1
						return [
							{
								index: 0,
								amount: "1",
								recipient: "B62older",
								cancelled: false,
								cancellable: true,
								synced: true,
								accepted: false,
								confirmed: false,
								finalised: false,
								hash: "submit-older",
								timestamp: "2026-03-09T19:00:00.000Z"
							},
							{
								index: 1,
								amount: "2",
								recipient: "B62cancel",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: false,
								hash: "submit-current",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return false
					},
					async canCancelDeposit() {
						return true
					},
					async cancelDeposit() {
						cancelCalls.push(`cancel-${cancelCalls.length + 1}`)
						return {
							success: true,
							direction: "deposit",
							action: "cancel",
							route: "mina:testnet->zeko:testnet",
							hash: `cancel-${cancelCalls.length}`,
							explorerUrl: "https://minascan.io/devnet/tx/cancel-older",
							included: false
						}
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async () => {},
				sleep: async () => {
					if (statusCalls >= 2) {
						throw new Error("stop-after-second-poll")
					}
				},
				pollIntervalMs: 0
			}
		)

		expect(result.status).toBe("failed")
		expect(result.lastError).toBe("stop-after-second-poll")
		expect(cancelCalls).toEqual(["cancel-1"])
	})

	it("retries a stale finalize submission when the claimable index never clears", async () => {
		let statusCalls = 0
		const finalizeCalls: string[] = []

		const result = await runBridgeOperation(
			{
				id: "op-retry-stale-finalize",
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62finalize"
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
							included: false
						}
					},
					async getDepositStatuses() {
						statusCalls += 1

						if (finalizeCalls.length >= 2) {
							return [
								{
									index: 7,
									amount: "2",
									recipient: "B62finalize",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: true,
									hash: "finalize-second",
									timestamp: "2026-03-09T19:03:00.000Z"
								}
							]
						}

						return [
							{
								index: 7,
								amount: "2",
								recipient: "B62finalize",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: false,
								hash: "submit-current",
								timestamp: "2026-03-09T19:01:00.000Z"
							}
						]
					},
					async canFinalizeDeposit() {
						return true
					},
					async canCancelDeposit() {
						return false
					},
					async finalizeDeposit() {
						const hash = finalizeCalls.length === 0 ? "finalize-first" : "finalize-second"
						finalizeCalls.push(hash)
						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash,
							explorerUrl: `https://zekoscan.io/testnet/tx/${hash}`,
							included: false
						}
					}
				},
				sessionStore: {
					async save() {}
				},
				log: async () => {},
				sleep: async () => {},
				pollIntervalMs: 0,
				now: () =>
					statusCalls >= 2 && finalizeCalls.length === 1
						? "2026-03-10T00:03:01.000Z"
						: finalizeCalls.length >= 2
							? "2026-03-10T00:03:02.000Z"
							: "2026-03-10T00:00:00.000Z"
			}
		)

		expect(statusCalls).toBeGreaterThanOrEqual(3)
		expect(finalizeCalls).toEqual(["finalize-first", "finalize-second"])
		expect(result.status).toBe("completed")
		expect(result.finalTransaction?.hash).toBe("finalize-second")
	})

	it("keeps waiting when a queued withdrawal looks claimable before witnesses are ready", async () => {
		let withdrawalStatusCalls = 0
		let finalizeAttempts = 0
		const events: Array<{ event: string; details?: Record<string, unknown> }> = []

		const result = await runBridgeOperation(
			{
				id: "op-withdrawal-claim-pending",
				from: "zeko:testnet",
				to: "mina:testnet",
				amount: "1",
				account: "B62claim"
			},
			{
				adapter: {
					async submitWithdrawal() {
						return {
							success: true,
							direction: "withdrawal",
							action: "submit",
							route: "zeko:testnet->mina:testnet",
							hash: "withdraw-submit-current",
							explorerUrl: "https://zekoscan.io/testnet/tx/withdraw-submit-current",
							included: false
						}
					},
					async getWithdrawalStatuses() {
						withdrawalStatusCalls += 1

						if (withdrawalStatusCalls === 1) {
							return [
								{
									index: 7,
									amount: "2",
									recipient: "B62claim",
									committed: true,
									finalised: false,
									hash: "withdraw-submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								}
							]
						}

						if (withdrawalStatusCalls === 2) {
							return [
								{
									index: 7,
									amount: "2",
									recipient: "B62claim",
									committed: true,
									finalised: false,
									hash: "withdraw-submit-older",
									timestamp: "2026-03-09T19:00:00.000Z"
								},
								{
									index: 8,
									amount: "1",
									recipient: "B62claim",
									committed: true,
									finalised: false,
									hash: "withdraw-submit-current",
									timestamp: "2026-03-09T19:01:00.000Z"
								}
							]
						}

						return [
							{
								index: 7,
								amount: "2",
								recipient: "B62claim",
								committed: true,
								finalised: true,
								hash: "withdraw-finalize-older",
								timestamp: "2026-03-09T19:02:00.000Z"
							},
							{
								index: 8,
								amount: "1",
								recipient: "B62claim",
								committed: true,
								finalised: true,
								hash: "withdraw-finalize-current",
								timestamp: "2026-03-09T19:03:00.000Z"
							}
						]
					},
					async canFinalizeWithdrawal() {
						return true
					},
					async finalizeWithdrawal() {
						finalizeAttempts += 1
						if (finalizeAttempts === 1) {
							throw new Error("Did not find any withdrawal to finalize")
						}

						return {
							success: true,
							direction: "withdrawal",
							action: "finalize",
							route: "zeko:testnet->mina:testnet",
							hash: "withdraw-finalize-current",
							explorerUrl: "https://minascan.io/devnet/tx/withdraw-finalize-current",
							included: false
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

		expect(result.status).toBe("completed")
		expect(finalizeAttempts).toBe(2)
		expect(
			events.some(
				(entry) =>
					entry.event === "claim-pending" &&
					entry.details?.message === "Did not find any withdrawal to finalize"
			)
		).toBe(true)
	})
})
