import { describe, expect, it } from "vitest"
import { PublicKey, UInt64 } from "o1js"
import {
	assertFirstWithdrawalAmountCanCreateHelper,
	InsufficientFirstWithdrawalAmountError,
	isInsufficientFirstWithdrawalAmountError
} from "../src/errors"

const recipient = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")

describe("first withdrawal amount guard", () => {
	it("throws a protocol error when the helper account is missing and the amount is below the l1 fee", () => {
		expect(() =>
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: false,
				amount: UInt64.from(200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000)
			})
		).toThrow(InsufficientFirstWithdrawalAmountError)

		expect(() =>
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: false,
				amount: UInt64.from(200_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000)
			})
		).toThrow(/First Zeko->Mina withdrawal amount is too small/)
	})

	it("allows first withdrawals that can cover the l1 account creation fee", () => {
		expect(() =>
			assertFirstWithdrawalAmountCanCreateHelper({
				helperAccountExists: false,
				amount: UInt64.from(1_000_000_000),
				recipient,
				accountCreationFee: UInt64.from(1_000_000_000)
			})
		).not.toThrow()
	})

	it("detects the shared terminal error by instance or message", () => {
		const error = new InsufficientFirstWithdrawalAmountError({
			amountNanomina: 200_000_000n,
			accountCreationFeeNanomina: 1_000_000_000n,
			recipient: recipient.toBase58()
		})

		expect(isInsufficientFirstWithdrawalAmountError(error)).toBe(true)
		expect(isInsufficientFirstWithdrawalAmountError(error.message)).toBe(true)
		expect(isInsufficientFirstWithdrawalAmountError(new Error("something else"))).toBe(false)
	})
})
