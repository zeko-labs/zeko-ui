import { describe, expect, it } from "vitest"
import { GatewayClient } from "../src/gateway"

const withdrawal = {
	settlementSequence: 1,
	offset: 0,
	globalActionIndex: 3,
	recipient: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
	amount: "18446744073709551615",
	actionFieldsHash: `0x${"11".repeat(32)}`,
	siblings: Array.from({ length: 16 }, () => `0x${"22".repeat(32)}`),
	innerActionRoot: `0x${"33".repeat(32)}`,
	commitSlotUpper: 8,
	claimableSlot: 13,
	currentVirtualSlot: 13,
	recipientCursor: 3,
	status: "claimable",
	nextAction: "claimNativeWithdrawal"
}

describe("GatewayClient", () => {
	it("preserves the full UInt64 withdrawal amount", async () => {
		const fetcher: typeof fetch = async () => Response.json(withdrawal)
		const result = await new GatewayClient("https://gateway.test", fetcher).withdrawal(1, 0)
		expect(result.amount).toBe("18446744073709551615")
	})

	it("rejects withdrawal amounts encoded as unsafe JSON numbers", async () => {
		const fetcher: typeof fetch = async () => Response.json({ ...withdrawal, amount: 2 ** 63 })
		await expect(
			new GatewayClient("https://gateway.test", fetcher).withdrawal(1, 0)
		).rejects.toThrow("Invalid withdrawal.amount")
	})

	it("loads pending withdrawal requests from canonical archive activity", async () => {
		const request = {
			globalActionIndex: 4,
			transactionHash: "5Jwithdrawal",
			blockHeight: 9,
			timestamp: "1784159326275",
			recipient: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
			amount: "5000000000",
			status: "pendingSettlement",
			nextAction: "waitForSettlement"
		}
		const fetcher: typeof fetch = async () => Response.json([request])
		await expect(
			new GatewayClient("https://gateway.test", fetcher).withdrawalRequests({
				recipient: request.recipient
			})
		).resolves.toEqual([{ ...request, recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" }])
	})
})
