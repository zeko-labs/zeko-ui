import { PublicKey, UInt64 } from "o1js"
import { describe, expect, it, vi } from "vitest"
import {
	assertBridgeTransferAmountCanCoverFees,
	ensureBridgeTransferAmountCanCoverFees,
	InsufficientBridgeTransferAmountError,
	InsufficientFirstWithdrawalAmountError,
	isInsufficientBridgeTransferAmountError,
	isInsufficientFirstWithdrawalAmountError,
	minimumBridgeTransferAmount
} from "../src/errors"

const recipient = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")
const accountCreationFee = UInt64.from(1_000_000_000)
const bridgeProofFee = UInt64.from(100_000_000)

describe("bridge transfer fee requirement", () => {
	it.each([
		{
			recipientAccountExists: true,
			helperAccountExists: true,
			expected: 200_000_000
		},
		{
			recipientAccountExists: false,
			helperAccountExists: true,
			expected: 1_200_000_000
		},
		{
			recipientAccountExists: true,
			helperAccountExists: false,
			expected: 1_200_000_000
		},
		{
			recipientAccountExists: false,
			helperAccountExists: false,
			expected: 2_200_000_000
		}
	])(
		"requires two proof fees and the fees for missing destination accounts",
		({ recipientAccountExists, helperAccountExists, expected }) => {
			expect(
				minimumBridgeTransferAmount({
					accountCreationFee,
					bridgeProofFee,
					recipientAccountExists,
					helperAccountExists
				}).toBigInt()
			).toBe(BigInt(expected))
		}
	)

	it("accepts an amount exactly equal to the calculated minimum", () => {
		expect(() =>
			assertBridgeTransferAmountCanCoverFees({
				direction: "deposit",
				amount: UInt64.from(1_200_000_000),
				recipient,
				accountCreationFee,
				bridgeProofFee,
				recipientAccountExists: false,
				helperAccountExists: true
			})
		).not.toThrow()
	})

	it.each(["deposit", "withdrawal"] as const)(
		"throws a stable error for an underfunded %s",
		(direction) => {
			expect(() =>
				assertBridgeTransferAmountCanCoverFees({
					direction,
					amount: UInt64.from(2_199_999_999),
					recipient,
					accountCreationFee,
					bridgeProofFee,
					recipientAccountExists: false,
					helperAccountExists: false
				})
			).toThrow(InsufficientBridgeTransferAmountError)

			try {
				assertBridgeTransferAmountCanCoverFees({
					direction,
					amount: UInt64.from(2_199_999_999),
					recipient,
					accountCreationFee,
					bridgeProofFee,
					recipientAccountExists: false,
					helperAccountExists: false
				})
			} catch (error) {
				expect(isInsufficientBridgeTransferAmountError(error)).toBe(true)
				expect(error).toMatchObject({
					code: "INSUFFICIENT_BRIDGE_TRANSFER_AMOUNT",
					direction,
					requiredAmountNanomina: 2_200_000_000n
				})
				expect(String(error)).toContain(direction === "deposit" ? "Mina->Zeko" : "Zeko->Mina")
			}
		}
	)

	it("skips destination account lookups when the amount covers the maximum requirement", async () => {
		const recipientAccountExists = vi.fn(() => false)
		const helperAccountExists = vi.fn(() => false)

		await expect(
			ensureBridgeTransferAmountCanCoverFees({
				direction: "deposit",
				amount: UInt64.from(2_200_000_000),
				recipient,
				accountCreationFee,
				bridgeProofFee,
				recipientAccountExists,
				helperAccountExists
			})
		).resolves.toBeUndefined()

		expect(recipientAccountExists).not.toHaveBeenCalled()
		expect(helperAccountExists).not.toHaveBeenCalled()
	})

	it("checks both destination accounts before rejecting an amount below the maximum", async () => {
		const recipientAccountExists = vi.fn(() => true)
		const helperAccountExists = vi.fn(() => false)

		await expect(
			ensureBridgeTransferAmountCanCoverFees({
				direction: "withdrawal",
				amount: UInt64.from(1_199_999_999),
				recipient,
				accountCreationFee,
				bridgeProofFee,
				recipientAccountExists,
				helperAccountExists
			})
		).rejects.toThrow(InsufficientBridgeTransferAmountError)

		expect(recipientAccountExists).toHaveBeenCalledTimes(1)
		expect(helperAccountExists).toHaveBeenCalledTimes(1)
	})

	it("preserves the legacy first-withdrawal error discriminator", () => {
		const error = new InsufficientFirstWithdrawalAmountError({
			amountNanomina: 200_000_000n,
			accountCreationFeeNanomina: 1_000_000_000n,
			recipient: recipient.toBase58()
		})

		expect(error.code).toBe("INSUFFICIENT_FIRST_WITHDRAWAL_AMOUNT")
		expect(isInsufficientFirstWithdrawalAmountError(error)).toBe(true)
	})
})
