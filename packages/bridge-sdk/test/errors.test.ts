import { describe, expect, it, vi } from "vitest"
import { PublicKey, UInt64 } from "o1js"
import {
	assertFirstWithdrawalAmountCanCreateHelper,
	ensureFirstWithdrawalAmountCanCreateHelper,
	InsufficientFirstWithdrawalAmountError,
	isInsufficientFirstWithdrawalAmountError
} from "../src/errors"

const recipient = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")

describe("first withdrawal amount guard", () => {
	it("throws a protocol error when the helper account is missing and the amount is below the l1 fee", () => {
		expect(() =>
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: false,
				recipientAccountExists: false,
				amount: UInt64.from(200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000),
				bridgeProofFee: UInt64.from(200_000_000)
			})
		).toThrow(InsufficientFirstWithdrawalAmountError)

		expect(() =>
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: false,
				recipientAccountExists: false,
				amount: UInt64.from(200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000),
				bridgeProofFee: UInt64.from(200_000_000)
			})
		).toThrow(/First Zeko->Mina withdrawal amount is too small/)
	})

	it("allows first withdrawals that can cover both missing L1 accounts and the proof fee", () => {
		expect(() =>
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: false,
				recipientAccountExists: false,
				amount: UInt64.from(2_200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000),
				bridgeProofFee: UInt64.from(200_000_000)
			})
		).not.toThrow()
	})

	it("allows first withdrawals at the lower threshold when the recipient L1 account exists", () => {
		expect(() =>
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: false,
				recipientAccountExists: true,
				amount: UInt64.from(1_200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000),
				bridgeProofFee: UInt64.from(200_000_000)
			})
		).not.toThrow()
	})

	it("skips the helper-account lookup when the withdrawal already meets the threshold", async () => {
		const helperAccountExists = vi.fn(() => false)
		const recipientAccountExists = vi.fn(() => false)

		await expect(
			ensureFirstWithdrawalAmountCanCreateHelper({
				amount: UInt64.from(2_200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000),
				bridgeProofFee: UInt64.from(200_000_000),
				helperAccountExists,
				recipientAccountExists
			})
		).resolves.toBeUndefined()

		expect(helperAccountExists).not.toHaveBeenCalled()
		expect(recipientAccountExists).not.toHaveBeenCalled()
	})

	it("checks account state before failing smaller withdrawals", async () => {
		const helperAccountExists = vi.fn(() => false)
		const recipientAccountExists = vi.fn(() => true)

		await expect(
			ensureFirstWithdrawalAmountCanCreateHelper({
				amount: UInt64.from(1_200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000),
				bridgeProofFee: UInt64.from(200_000_000),
				helperAccountExists,
				recipientAccountExists
			})
		).resolves.toBeUndefined()

		expect(helperAccountExists).toHaveBeenCalledTimes(1)
		expect(recipientAccountExists).toHaveBeenCalledTimes(1)
	})

	it("fails small withdrawals when the helper account is still missing", async () => {
		const helperAccountExists = vi.fn(() => false)
		const recipientAccountExists = vi.fn(() => false)

		await expect(
			ensureFirstWithdrawalAmountCanCreateHelper({
				amount: UInt64.from(1_200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000),
				bridgeProofFee: UInt64.from(200_000_000),
				helperAccountExists,
				recipientAccountExists
			})
		).rejects.toThrow(InsufficientFirstWithdrawalAmountError)

		expect(helperAccountExists).toHaveBeenCalledTimes(1)
		expect(recipientAccountExists).toHaveBeenCalledTimes(1)
	})

	it("detects the shared terminal error by instance or message", () => {
		const error = new InsufficientFirstWithdrawalAmountError({
			amountNanomina: 200_000_000n,
			minimumAmountNanomina: 2_200_000_000n,
			recipient: recipient.toBase58()
		})

		expect(isInsufficientFirstWithdrawalAmountError(error)).toBe(true)
		expect(isInsufficientFirstWithdrawalAmountError(error.message)).toBe(true)
		expect(isInsufficientFirstWithdrawalAmountError(new Error("something else"))).toBe(false)
	})
})
