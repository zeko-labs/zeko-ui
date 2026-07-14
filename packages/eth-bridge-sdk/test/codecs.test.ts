import { Field, PublicKey } from "o1js"
import { getAddress } from "viem"
import { describe, expect, it } from "vitest"
import {
	ethereumAddressToZekoPublicKey,
	packZekoAddress,
	unpackZekoAddress,
	weiToZekoNativeUnits,
	zekoNativeUnitsToWei,
	zekoPublicKeyToEthereumAddress
} from "../src/index"

describe("Ethereum bridge codecs", () => {
	it("round-trips packed Zeko public keys", () => {
		for (const isOdd of [0, 1]) {
			const key = PublicKey.fromFields([Field(0x01020304), Field(isOdd)])
			expect(unpackZekoAddress(packZekoAddress(key)).toBase58()).toBe(key.toBase58())
		}
	})

	it("round-trips an Ethereum address through the synthetic public key", () => {
		const address = getAddress("0x1234567890abcdef1234567890abcdef12345678")
		expect(zekoPublicKeyToEthereumAddress(ethereumAddressToZekoPublicKey(address))).toBe(address)
	})

	it("rejects odd and oversized synthetic Ethereum keys", () => {
		expect(() =>
			zekoPublicKeyToEthereumAddress(PublicKey.fromFields([Field(1), Field(1)]))
		).toThrow("even synthetic")
		expect(() =>
			zekoPublicKeyToEthereumAddress(PublicKey.fromFields([Field(1n << 160n), Field(0)]))
		).toThrow("does not contain")
	})

	it("normalizes native amounts without losing precision", () => {
		expect(weiToZekoNativeUnits(1_000_000_000n)).toBe(1n)
		expect(zekoNativeUnitsToWei(1n)).toBe(1_000_000_000n)
		expect(() => weiToZekoNativeUnits(1n)).toThrow("9-decimal")
		expect(() => weiToZekoNativeUnits(0n)).toThrow("greater than zero")
	})
})
