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

const tokenWithdrawal = {
	...withdrawal,
	token: "0x00000000000000000000000000000000000000a1",
	assetId: `0x${"44".repeat(32)}`,
	nextAction: "claimERC20Withdrawal"
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

	it("preserves the token and asset identity of an ERC20 withdrawal proof", async () => {
		const fetcher: typeof fetch = async () => Response.json(tokenWithdrawal)
		await expect(
			new GatewayClient("https://gateway.test", fetcher).tokenWithdrawal(1, 0)
		).resolves.toMatchObject({
			token: "0x00000000000000000000000000000000000000A1",
			assetId: tokenWithdrawal.assetId,
			amount: tokenWithdrawal.amount,
			recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		})
	})

	it("exposes the proof-bound asset ID on indexed ERC20 deposits", async () => {
		const deposit = {
			nonce: 7,
			token: tokenWithdrawal.token,
			assetId: tokenWithdrawal.assetId,
			sender: withdrawal.recipient,
			zekoRecipient: `0x${"55".repeat(32)}`,
			ethereumAmount: "2000000",
			zekoAmount: "2000000",
			timeout: 4_294_967_295,
			ethereumTransactionHash: `0x${"66".repeat(32)}`,
			ethereumFinalized: true,
			encodingVersion: null,
			bridgeJobId: null,
			bridgeJobStatus: null,
			outerActionSequence: null,
			outerActionStateAfter: null,
			synchronizedSettlementSequence: null,
			status: "locked",
			nextAction: "requestBridgeProof"
		}
		const fetcher: typeof fetch = async () => Response.json(deposit)
		await expect(
			new GatewayClient("https://gateway.test", fetcher).deposit(7)
		).resolves.toMatchObject({ assetId: tokenWithdrawal.assetId })
	})

	it("requires immutable encoding metadata once an ERC20 outer action exists", async () => {
		const deposit = {
			nonce: 7,
			token: tokenWithdrawal.token,
			assetId: tokenWithdrawal.assetId,
			sender: withdrawal.recipient,
			zekoRecipient: `0x${"55".repeat(32)}`,
			ethereumAmount: "2000000",
			zekoAmount: "2000000",
			timeout: 4_294_967_295,
			ethereumTransactionHash: `0x${"66".repeat(32)}`,
			ethereumFinalized: true,
			encodingVersion: null,
			bridgeJobId: "job",
			bridgeJobStatus: "confirmed",
			outerActionSequence: 5,
			outerActionStateAfter: "state",
			synchronizedSettlementSequence: 2,
			status: "synchronized",
			nextAction: "finalizeDepositOnZeko"
		}
		const fetcher: typeof fetch = async () => Response.json(deposit)

		await expect(new GatewayClient("https://gateway.test", fetcher).deposit(7)).rejects.toThrow(
			"encodingVersion"
		)
		await expect(
			new GatewayClient("https://gateway.test", async () =>
				Response.json({ ...deposit, encodingVersion: 1 })
			).deposit(7)
		).resolves.toMatchObject({ encodingVersion: 1 })
		await expect(
			new GatewayClient("https://gateway.test", async () =>
				Response.json({
					...deposit,
					token: "0x0000000000000000000000000000000000000000",
					assetId: null,
					encodingVersion: undefined
				})
			).deposit(7)
		).resolves.toMatchObject({ encodingVersion: null })

		const { assetId: _assetId, ...legacyDeposit } = deposit
		await expect(
			new GatewayClient("https://gateway.test", async (input) =>
				Response.json(String(input).includes("?") ? [legacyDeposit] : legacyDeposit)
			).deposit(7)
		).resolves.toMatchObject({ assetId: null, encodingVersion: null })
		await expect(
			new GatewayClient("https://gateway.test", async () =>
				Response.json([legacyDeposit])
			).deposits()
		).resolves.toMatchObject([{ assetId: null, encodingVersion: null }])
	})
})
