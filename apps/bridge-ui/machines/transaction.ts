import type { SendZkTransactionResult, ZkappCommand } from "@aurowallet/mina-provider"
import type { walletMachine } from "@lumina-dex/sdk"
import { type Mina, Transaction } from "o1js"
import { assign, fromPromise, setup } from "xstate"
import type { ActorRefFromLogic } from "xstate"
import { createLogger } from "./debug"
import { processHash } from "./helpers"

type Wallet = ActorRefFromLogic<typeof walletMachine>
const { act, logger } = createLogger("[TRANSACTION]")

export type TransactionMachineContext = {
	transaction: string
	wallet: Wallet
	signedTransaction: SendZkTransactionResult | null
	sentTransaction: Mina.PendingTransaction | null
	includedTransaction: Mina.IncludedTransaction | null
	result: ReturnType<typeof processHash> | Error
}

type TransactionMachineInput = {
	transaction: Mina.Transaction<false, false> | string
	wallet: Wallet
}

type TransactionMachineOutput = {
	result: ReturnType<typeof processHash> | Error
}

type SendSignedTxInput = { signedTransaction: SendZkTransactionResult }
type WaitForTxInput = { sentTransaction: Mina.PendingTransaction }
export const transactionMachine = setup({
	types: {
		context: {} as TransactionMachineContext,
		input: {} as TransactionMachineInput,
		output: {} as TransactionMachineOutput
	},
	actors: {
		signTransaction: fromPromise<SendZkTransactionResult, { transaction: string }>(({ input }) => {
			return act("signTransaction", async () => {
				const { transaction } = input
				const result = await window.mina.sendTransaction({ onlySign: true, transaction })
				if (result instanceof Error) throw result
				logger.success("Transaction signed", result)
				return result
			})
		}),
		sendSignedTransaction: fromPromise<Mina.PendingTransaction, SendSignedTxInput>(({ input }) => {
			return act("sendSignedTransaction", async () => {
				const { signedTransaction } = input
				if ("signedData" in signedTransaction) {
					// biome-ignore lint/suspicious/noExplicitAny: <explanation>
					const parsedJson = (JSON.parse(signedTransaction.signedData) as any)
						.zkappCommand as ZkappCommand
					const sentTransaction = await Transaction.fromJSON(parsedJson).send()
					logger.success("Transaction sent", sentTransaction)
					return sentTransaction
				}
				throw new Error("No signedData found")
			})
		}),
		waitForTransaction: fromPromise<Mina.IncludedTransaction, WaitForTxInput>(({ input }) => {
			return act("waitForTransaction", async () => {
				const { sentTransaction } = input
				const result = await sentTransaction.wait()
				logger.success("Transaction included:", result)
				return result
			})
		})
	}
}).createMachine({
	id: "transaction",
	initial: "SIGNING",
	context: ({ input: { transaction, wallet } }) => ({
		transaction: typeof transaction === "string" ? transaction : transaction.toJSON(),
		wallet,
		signedTransaction: null,
		sentTransaction: null,
		includedTransaction: null,
		result: new Error("Transaction failed")
	}),
	output: ({ context: { result } }) => ({ result }),
	states: {
		SIGNING: {
			invoke: {
				src: "signTransaction",
				input: ({ context: { transaction } }) => ({ transaction }),
				onDone: {
					guard: ({ event }) => "signedData" in event.output,
					actions: assign({ signedTransaction: ({ event }) => event.output }),
					target: "SENDING"
				},
				onError: {
					target: "FAILED",
					actions: assign({ result: ({ event }) => event.error as Error })
				}
			}
		},
		SENDING: {
			invoke: {
				src: "sendSignedTransaction",
				input: ({ context: { signedTransaction } }) => {
					if (!signedTransaction) throw new Error("No signed transaction to send")
					return { signedTransaction }
				},
				onDone: [
					{
						target: "WAITING",
						guard: ({ context }) =>
							context.wallet.getSnapshot().context.currentNetwork.includes("mina"),
						actions: assign({ sentTransaction: ({ event }) => event.output })
					},
					{
						guard: ({ context }) =>
							context.wallet.getSnapshot().context.currentNetwork.includes("zeko"),
						target: "DONE",
						actions: assign(({ context, event }) => ({
							sentTransaction: event.output,
							result: processHash({
								hash: event.output.hash,
								transaction: context.transaction,
								wallet: context.wallet
							})
						}))
					}
				],
				onError: {
					target: "FAILED",
					actions: assign({ result: ({ event }) => event.error as Error })
				}
			}
		},
		WAITING: {
			invoke: {
				src: "waitForTransaction",
				input: ({ context: { sentTransaction } }) => {
					if (!sentTransaction) throw new Error("No sent transaction to wait for")
					return { sentTransaction }
				},
				onDone: {
					actions: assign(({ context, event }) => ({
						includedTransaction: event.output,
						result: processHash({
							hash: event.output.hash,
							transaction: context.transaction,
							wallet: context.wallet
						})
					})),
					target: "DONE"
				},
				onError: {
					target: "FAILED",
					actions: assign({ result: ({ event }) => event.error as Error })
				}
			}
		},
		DONE: { type: "final" },
		FAILED: { type: "final" }
	}
})
