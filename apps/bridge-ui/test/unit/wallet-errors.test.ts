import { describe, expect, it } from "vitest"
import {
	isTerminalBridgeError,
	isWalletRejection,
	QuietError,
	toQuietIfWalletRejection,
	toUserFriendlyMessage
} from "../../app/errors"

describe("isWalletRejection", () => {
	it("detects 'User reject' as a wallet rejection", () => {
		expect(isWalletRejection(new Error("User reject the request"))).toBe(true)
	})

	it("detects 'user rejected' (case-insensitive) as a wallet rejection", () => {
		expect(isWalletRejection(new Error("user rejected"))).toBe(true)
	})

	it("detects 'connection declined' as a wallet rejection", () => {
		expect(isWalletRejection(new Error("connection declined"))).toBe(true)
	})

	it("returns false for unrelated errors", () => {
		expect(isWalletRejection(new Error("Network error"))).toBe(false)
	})

	it("handles string errors", () => {
		expect(isWalletRejection("User reject")).toBe(true)
	})

	it("handles plain objects with message property", () => {
		expect(isWalletRejection({ code: 1002, message: "User reject the request" })).toBe(true)
		expect(isWalletRejection({ code: 1002, message: "connection declined" })).toBe(true)
		expect(isWalletRejection({ code: 500, message: "Server error" })).toBe(false)
	})
})

describe("toQuietIfWalletRejection", () => {
	it("converts wallet rejection to QuietError", () => {
		const result = toQuietIfWalletRejection(new Error("User reject the request"))
		expect(result).toBeInstanceOf(QuietError)
		expect(result.message).toBe("User reject the request")
	})

	it("converts 'connection declined' to QuietError", () => {
		const result = toQuietIfWalletRejection(new Error("connection declined"))
		expect(result).toBeInstanceOf(QuietError)
	})

	it("passes through non-rejection errors as-is", () => {
		const error = new Error("Some other error")
		const result = toQuietIfWalletRejection(error)
		expect(result).toBe(error)
		expect(result).not.toBeInstanceOf(QuietError)
	})

	it("wraps non-Error values in Error", () => {
		const result = toQuietIfWalletRejection("string error")
		expect(result).toBeInstanceOf(Error)
		expect(result.message).toBe("string error")
	})
})

describe("toUserFriendlyMessage", () => {
	const firstWithdrawalTooSmall =
		"First Zeko->Mina withdrawal amount is too small: recipient B62test does not have an L1 helper account yet, so the first withdrawal must be at least 1 MINA to cover the Mina account creation fee. This withdrawal is 0.2 MINA and cannot proceed as submitted."

	it("maps wallet RPC 'Method not found' to update message", () => {
		expect(toUserFriendlyMessage(new Error("Error invoking post: Method not found"))).toContain(
			"update your Auro Wallet"
		)
	})

	it("maps CombinedError network failure", () => {
		expect(toUserFriendlyMessage(new Error("CombinedError: [Network] Failed to fetch"))).toContain(
			"temporarily unreachable"
		)
	})

	it("maps CombinedError GraphQL failure", () => {
		expect(toUserFriendlyMessage(new Error("CombinedError: [GraphQL] Unexpected error"))).toContain(
			"unexpected error"
		)
	})

	it("maps 'TypeError: Load failed'", () => {
		expect(toUserFriendlyMessage(new Error("TypeError: Load failed"))).toContain(
			"network request failed"
		)
	})

	it("maps truncated JSON response", () => {
		expect(toUserFriendlyMessage(new Error("Unexpected end of input"))).toContain(
			"incomplete response"
		)
	})

	it("maps account data fetch failure", () => {
		expect(toUserFriendlyMessage(new Error("Error getting account data"))).toContain("account data")
	})

	it("maps bridge-sdk validation errors", () => {
		expect(toUserFriendlyMessage(new Error("Invalid actions data"))).toContain(
			"invalid on-chain data"
		)
		expect(toUserFriendlyMessage(new Error("Invalid witnesses data"))).toContain(
			"invalid proof data"
		)
	})

	it("maps runtime config error", () => {
		expect(toUserFriendlyMessage(new Error("Invalid runtime config"))).toContain(
			"network configuration"
		)
	})

	it("maps rangeCheck32 error", () => {
		expect(
			toUserFriendlyMessage(new Error("rangeCheck32: expected field to fit in 32 bits"))
		).toContain("out-of-range data")
	})

	it("maps the first-withdrawal-too-small protocol error", () => {
		const message = toUserFriendlyMessage(new Error(firstWithdrawalTooSmall))
		expect(message).toContain("first Zeko-to-Mina withdrawal")
		expect(message).toContain("at least 2.2 MINA")
		expect(isTerminalBridgeError(new Error(firstWithdrawalTooSmall))).toBe(true)
	})

	it("passes through unknown errors unchanged", () => {
		expect(toUserFriendlyMessage(new Error("Something totally new"))).toBe("Something totally new")
	})

	it("handles string input", () => {
		expect(toUserFriendlyMessage("Invalid actions data")).toContain("invalid on-chain data")
	})
})
