import type { ZkappCommand } from "@aurowallet/mina-provider"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createActor, toPromise } from "xstate"
import { transactionMachine } from "../../machines/transaction"

const unsignedTransaction = ({ fee, user }: { fee: number; user: string }) =>
	JSON.stringify({
		accountUpdates: [],
		feePayer: { authorization: "", body: { fee: String(fee), publicKey: user } },
		memo: ""
	})

describe("transactionMachine", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("signs and completes an SDK transaction", async () => {
		const user = "B62qtest-user"
		const signedCommand = {
			accountUpdates: [],
			feePayer: { authorization: "", body: { fee: "100", publicKey: user } },
			memo: ""
		} as unknown as ZkappCommand
		const sendTransaction = vi.fn(async () => ({
			signedData: JSON.stringify({ zkappCommand: signedCommand })
		}))
		const createSdkSignature = vi.fn(async ({ feeNanomina }: { feeNanomina: number }) => ({
			requestId: `request-${feeNanomina}`,
			transaction: unsignedTransaction({ fee: feeNanomina, user })
		}))
		const completeSdkSignature = vi.fn(async () => "5JtransactionHash")
		vi.stubGlobal("mina", { sendTransaction })

		const actor = createActor(transactionMachine, {
			input: {
				id: "operation-1",
				key: "submitDeposit",
				user,
				network: "mina:devnet",
				initialFeeNanomina: 100,
				createSdkSignature,
				completeSdkSignature
			}
		})

		actor.start()
		const output = await toPromise(actor)

		expect(createSdkSignature).toHaveBeenCalledWith({ feeNanomina: 100 })
		expect(sendTransaction).toHaveBeenCalledWith({
			onlySign: true,
			transaction: unsignedTransaction({ fee: 100, user })
		})
		expect(completeSdkSignature).toHaveBeenCalledWith({
			requestId: "request-100",
			signedTransaction: signedCommand
		})
		expect(output.result).toEqual({
			hash: "5JtransactionHash",
			url: "https://minascan.io/devnet/tx/5JtransactionHash"
		})
	})

	it("rebuilds and re-signs the SDK transaction when completion fails with a low-fee error", async () => {
		const user = "B62qtest-user"
		const createSdkSignature = vi.fn(async ({ feeNanomina }: { feeNanomina: number }) => ({
			requestId: `request-${feeNanomina}`,
			transaction: unsignedTransaction({ fee: feeNanomina, user })
		}))
		const completeSdkSignature = vi.fn(async ({ requestId }: { requestId: string }) => {
			if (requestId === "request-100") throw new Error('Transaction failed: "Fee is too low"')
			return "5JretryHash"
		})
		const sendTransaction = vi.fn(async ({ transaction }: { transaction: string }) => ({
			signedData: JSON.stringify({
				zkappCommand: JSON.parse(transaction) as ZkappCommand
			})
		}))
		vi.stubGlobal("mina", { sendTransaction })

		const actor = createActor(transactionMachine, {
			input: {
				id: "operation-1",
				key: "submitDeposit",
				user,
				network: "mina:devnet",
				initialFeeNanomina: 100,
				createSdkSignature,
				completeSdkSignature
			}
		})

		actor.start()
		const output = await toPromise(actor)

		expect(createSdkSignature).toHaveBeenNthCalledWith(1, { feeNanomina: 100 })
		expect(createSdkSignature).toHaveBeenNthCalledWith(2, { feeNanomina: 200 })
		expect(sendTransaction).toHaveBeenCalledTimes(2)
		expect(output.result.hash).toBe("5JretryHash")
	})

	it("does not pass opaque transaction hashes to the wallet", async () => {
		const user = "B62qtest-user"
		const sendTransaction = vi.fn()
		vi.stubGlobal("mina", { sendTransaction })

		const actor = createActor(transactionMachine, {
			input: {
				id: "operation-1",
				key: "submitDeposit",
				user,
				network: "mina:devnet",
				createSdkSignature: async () => ({
					requestId: "request-opaque",
					transaction: "7mX8vFnToS4pXmBkyDWPwiDUAJHAbaeB1jnNfBAPMAKuKvamaE3kpG6ekiy8ZP6"
				}),
				completeSdkSignature: async () => "5JtransactionHash"
			}
		})

		actor.start()
		await expect(toPromise(actor)).rejects.toThrow(
			"Wallet signing requires a JSON zkApp transaction payload"
		)
		expect(sendTransaction).not.toHaveBeenCalled()
	})
})
