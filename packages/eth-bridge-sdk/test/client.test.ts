import type { DepositWithState } from "@zeko-labs/bridge-sdk"
import { describe, expect, it } from "vitest"
import { mergeDepositActivity } from "../src/client"
import type { DepositStatus } from "../src/gateway"

const gatewayDeposit = (outerActionSequence: number | null): DepositStatus => ({
	nonce: 4,
	token: "0x0000000000000000000000000000000000000000",
	sender: "0x0000000000000000000000000000000000000001",
	zekoRecipient: "0x01",
	ethereumAmount: "1000000000000000000",
	zekoAmount: "1000000000",
	timeout: 100,
	ethereumTransactionHash: `0x${"12".repeat(32)}`,
	ethereumFinalized: true,
	bridgeJobId: "job",
	bridgeJobStatus: "confirmed",
	outerActionSequence,
	outerActionStateAfter: "state",
	synchronizedSettlementSequence: 2,
	status: "synchronized",
	nextAction: "finalizeDepositOnZeko"
})

describe("deposit activity", () => {
	it("matches the gateway's one-based sequence to the canonical action index", () => {
		const state = {
			index: 3,
			accepted: true,
			bridgeVersion: "v2",
			cancellable: false,
			cancelled: false,
			confirmed: true,
			finalised: true,
			synced: true
		} as DepositWithState
		expect(mergeDepositActivity([gatewayDeposit(4)], [state])).toMatchObject([
			{
				actionIndex: 3,
				zekoFinalized: true,
				status: "finalized",
				nextAction: "none"
			}
		])
	})

	it("does not guess an L2 state before the outer action exists", () => {
		expect(mergeDepositActivity([gatewayDeposit(null)], [])).toMatchObject([
			{
				actionIndex: null,
				zekoFinalized: false,
				zekoState: null,
				status: "synchronized"
			}
		])
	})
})
