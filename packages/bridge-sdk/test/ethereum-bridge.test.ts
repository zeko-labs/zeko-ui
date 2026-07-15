import { Field, PublicKey, UInt32, UInt64 } from "o1js"
import { describe, expect, it } from "vitest"
import { ethereumDepositAux } from "../src/index"

const holder = PublicKey.fromFields([Field(1), Field(0)])

describe("Ethereum bridge compatibility", () => {
	it.each([
		[
			"1000000000",
			"16909060",
			false,
			"2e9d1b29cea8eaba8c1dfe6d8c78b21127ce44a8378b3c9d2ee9ba0ddbd7c849"
		],
		[
			"2000000000",
			"84281096",
			false,
			"1a03b5b4a38e241ee071764a843e5b7bf29aa0e455d7ccd53a83f729885bfb18"
		],
		[
			"3000000000",
			"151653132",
			true,
			"1adc48d4e3b4478369ec2d8ce4ca72c397c9e75f019b24c9d65c262ae9757fa9"
		]
	])("matches the OCaml deposit aux vector for %s", (amount, recipientX, isOdd, expected) => {
		const recipient = PublicKey.fromFields([Field(recipientX), Field(Number(isOdd))])
		const actual = ethereumDepositAux({
			recipient,
			amount: UInt64.from(amount),
			timeout: UInt32.MAXINT(),
			holderAccountL1: holder
		})

		expect(actual.toBigInt().toString(16).padStart(64, "0")).toBe(expected)
	})
})
