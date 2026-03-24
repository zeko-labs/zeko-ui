import type { PrivateKey } from "o1js"
import { describe, expect, it } from "vitest"
import { MAX_FEE_RETRIES, sendWithFeeRetries } from "../src/core/adapter"

describe("adapter fee retries", () => {
	it("doubles the fee on low-fee send failures until the transaction succeeds", async () => {
		const seenFees: bigint[] = []
		let attempts = 0

		const result = await sendWithFeeRetries({
			signer: {} as PrivateKey,
			initialFeeNanomina: 100n,
			createTransaction: async (feeNanomina) => {
				seenFees.push(feeNanomina)
				return {
					sign() {
						return {
							send: async () => {
								attempts += 1
								if (attempts < 3) {
									throw new Error('Transaction failed: "Fee is too low"')
								}

								return { hash: "ok" }
							}
						}
					}
				}
			}
		})

		expect(result).toEqual({ hash: "ok" })
		expect(seenFees).toEqual([100n, 200n, 400n])
	})

	it("does not retry errors that are unrelated to low fees", async () => {
		const seenFees: bigint[] = []

		await expect(
			sendWithFeeRetries({
				signer: {} as PrivateKey,
				initialFeeNanomina: 100n,
				createTransaction: async (feeNanomina) => {
					seenFees.push(feeNanomina)
					return {
						sign() {
							return {
								send: async () => {
									throw new Error("network unavailable")
								}
							}
						}
					}
				}
			})
		).rejects.toThrow("network unavailable")

		expect(seenFees).toEqual([100n])
	})

	it("gives up after the same retry budget as the ui transaction machine", async () => {
		const seenFees: bigint[] = []

		await expect(
			sendWithFeeRetries({
				signer: {} as PrivateKey,
				initialFeeNanomina: 100n,
				createTransaction: async (feeNanomina) => {
					seenFees.push(feeNanomina)
					return {
						sign() {
							return {
								send: async () => {
									throw new Error('Transaction failed: "Fee is too low"')
								}
							}
						}
					}
				}
			})
		).rejects.toThrow("Fee is too low")

		expect(seenFees).toHaveLength(MAX_FEE_RETRIES + 1)
		expect(seenFees).toEqual([100n, 200n, 400n, 800n, 1600n, 3200n])
	})
})
