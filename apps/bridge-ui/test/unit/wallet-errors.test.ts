import { describe, expect, it } from "vitest"
import { isWalletRejection, QuietError, toQuietIfWalletRejection } from "../../app/errors"

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
