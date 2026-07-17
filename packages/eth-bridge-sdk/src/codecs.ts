import { Field, PublicKey } from "o1js"
import { type Address, getAddress, type Hex, toHex } from "viem"

const SIGN_MASK = 1n << 255n
const X_MASK = SIGN_MASK - 1n
const ADDRESS_MAX = (1n << 160n) - 1n
const U64_MAX = (1n << 64n) - 1n
const WEI_PER_ZEKO_NATIVE_UNIT = 1_000_000_000n

export const ETHEREUM_DEPOSIT_HOLDER = PublicKey.fromFields([Field(1), Field(0)])

export const packZekoAddress = (publicKey: PublicKey): Hex => {
	const [xField, isOddField] = publicKey.toFields()
	if (!xField || !isOddField) throw new Error("Invalid Zeko public key fields")
	const x = xField.toBigInt()
	const isOdd = isOddField.toBigInt() !== 0n
	return toHex(x | (isOdd ? SIGN_MASK : 0n), { size: 32 })
}

export const unpackZekoAddress = (packed: Hex): PublicKey => {
	const value = BigInt(packed)
	return PublicKey.fromFields([Field(value & X_MASK), Field((value & SIGN_MASK) === 0n ? 0 : 1)])
}

export const ethereumAddressToZekoPublicKey = (address: Address): PublicKey =>
	PublicKey.fromFields([Field(BigInt(getAddress(address))), Field(0)])

export const zekoPublicKeyToEthereumAddress = (publicKey: PublicKey): Address => {
	const [xField, isOddField] = publicKey.toFields()
	if (!xField || !isOddField || isOddField.toBigInt() !== 0n) {
		throw new Error("Ethereum withdrawal recipient must use an even synthetic Zeko public key")
	}
	const x = xField.toBigInt()
	if (x > ADDRESS_MAX)
		throw new Error("Synthetic Zeko public key does not contain an Ethereum address")
	return getAddress(toHex(x, { size: 20 }))
}

export const weiToZekoNativeUnits = (wei: bigint): bigint => {
	if (wei <= 0n) throw new Error("Native bridge amount must be greater than zero")
	if (wei % WEI_PER_ZEKO_NATIVE_UNIT !== 0n) {
		throw new Error("Native bridge amount must use 9-decimal Zeko precision")
	}
	const value = wei / WEI_PER_ZEKO_NATIVE_UNIT
	if (value > U64_MAX) throw new Error("Native bridge amount exceeds the Zeko UInt64 range")
	return value
}

export const zekoNativeUnitsToWei = (value: bigint): bigint => {
	if (value <= 0n || value > U64_MAX) {
		throw new Error("Zeko native amount must be a positive UInt64")
	}
	return value * WEI_PER_ZEKO_NATIVE_UNIT
}
