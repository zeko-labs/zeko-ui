import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { walletMachine } from "@lumina-dex/sdk"
import {} from "idb"
import { type Mina, Transaction, fetchTransactionStatus } from "o1js"
import { assign, enqueueActions, fromPromise, setup } from "xstate"
import type { ActorRefFromLogic } from "xstate"
import { createLogger } from "./debug"
import { type HashDb, type SavedTransaction, hashDb } from "./helpers"

const { act, logger } = createLogger("[TRANSACTION]")

type Wallet = ActorRefFromLogic<typeof walletMachine>

export type Result = ReturnType<HashDb["createResult"]>

export type TransactionMachineContext = {
	id: string
	transaction: string
	wallet: Wallet
	user: string
	savedTransaction: SavedTransaction | null
	signedTransaction: ZkappCommand | null
	sentTransaction: Mina.PendingTransaction | null
	result: Result | Error
	db: HashDb
}

type TransactionMachineInput = {
	id: string
	transaction: Mina.Transaction<false, false> | string
	wallet: Wallet
}

type TransactionMachineOutput = { result: Result | Error }

type SendSignedTxInput = { zeko: boolean; signedTransaction: ZkappCommand; db: HashDb }

type WaitForTxInput = { transaction: Mina.PendingTransaction | string }

export const transactionMachine = setup({
	types: {
		context: {} as TransactionMachineContext,
		input: {} as TransactionMachineInput,
		output: {} as TransactionMachineOutput
	},
	actors: {
		findUnconfirmedTransaction: fromPromise<SavedTransaction | undefined, { db: HashDb }>(
			({ input }) => {
				return act("findUnconfirmedTransaction", async () => {
					const { db } = input
					const transaction = await db.findUnconfirmed()
					return transaction
				})
			}
		),
		signTransaction: fromPromise<ZkappCommand, { transaction: string; user: string }>(
			({ input }) => {
				return act("signTransaction", async () => {
					const { transaction, user } = input
					const originalTransaction = JSON.parse(transaction) as ZkappCommand
					console.log({ originalTransaction })
					// If the fee is 0, set it to 1 to avoid auro wallet error
					if (originalTransaction.feePayer.body.fee === "0") {
						originalTransaction.feePayer.body.fee = "1"
					}
					const result = await window.mina.sendTransaction({
						onlySign: true,
						transaction: JSON.stringify(originalTransaction)
					})
					if (result instanceof Error) throw result
					if ("signedData" in result) {
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						const zkappCommand = (JSON.parse(result.signedData) as any).zkappCommand as ZkappCommand
						console.log({ zkappCommand })
						// If the feePayer is not the user, we need to set the authorization to a dummy value
						if (zkappCommand.feePayer.body.publicKey !== user) {
							zkappCommand.feePayer.authorization =
								"7mWxjLYgbJUkZNcGouvhVj5tJ8yu9hoexb9ntvPK8t5LHqzmrL6QJjjKtf5SgmxB4QWkDw7qoMMbbNGtHVpsbJHPyTy2EzRQ"
						}
						return zkappCommand
					}
					throw new Error("Couldn't find signedData")
				})
			}
		),
		sendSignedTransaction: fromPromise<Mina.PendingTransaction, SendSignedTxInput>(({ input }) => {
			return act("sendSignedTransaction", async () => {
				const { signedTransaction: zkappCommand, db, zeko } = input
				console.log({ zkappCommand })
				const sentTransaction = await Transaction.fromJSON(zkappCommand).send()
				logger.success("Transaction sent", sentTransaction)
				await db.saveSigned({ hash: sentTransaction.hash, confirmed: zeko, zkappCommand })
				return sentTransaction
			})
		}),
		waitForTransaction: fromPromise<string, WaitForTxInput>(({ input }) => {
			return act("waitForTransaction", async () => {
				const { transaction } = input
				if (typeof transaction === "string") {
					const transactionStatus = async () => {
						const result = await fetchTransactionStatus(transaction)
						if (result === "PENDING") {
							await new Promise((r) => setTimeout(r, 2000))
							return transactionStatus()
						}
						if (result === "INCLUDED") return true
						throw new Error("Transactions status is unknown.")
					}
					await transactionStatus()
					return transaction
				}
				const result = await transaction.wait()
				logger.success("Transaction included:", result)
				return result.hash
			})
		})
	}
}).createMachine({
	id: "transaction",
	initial: "RESUMING",
	context: ({ input: { id, transaction: tx, wallet } }) => {
		const transaction = typeof tx === "string" ? tx : tx.toJSON()
		const { account, currentNetwork: network } = wallet.getSnapshot().context
		return {
			id,
			transaction,
			wallet,
			user: account,
			savedTransaction: null,
			signedTransaction: null,
			sentTransaction: null,
			result: new Error("Transaction failed"),
			db: hashDb({ network, account, transaction })
		}
	},
	output: ({ context: { result } }) => ({ result }),
	states: {
		RESUMING: {
			description: "Attempt to resume an unconfirmed transaction.",
			invoke: {
				src: "findUnconfirmedTransaction",
				input: ({ context: { db, id } }) => ({ db, id }),
				onDone: [
					{
						target: "SIGNING",
						guard: ({ event }) => event.output === undefined
					},
					{
						target: "WAITING",
						guard: ({ event }) => event.output !== undefined,
						actions: enqueueActions(({ enqueue, event }) => {
							if (!event.output) throw new Error("No output transaction found")
							enqueue.assign({ savedTransaction: event.output })
						})
					}
				]
			}
		},
		SIGNING: {
			description: "Sign a transaction and return the signed zkappCommand.",
			invoke: {
				src: "signTransaction",
				input: ({ context: { transaction, user } }) => ({ transaction, user }),
				onDone: {
					target: "SENDING",
					actions: assign({ signedTransaction: ({ event }) => event.output })
				}
			}
		},
		SENDING: {
			description: "Send a signed transaction with o1js, and save it to idb.",
			invoke: {
				src: "sendSignedTransaction",
				input: ({ context: { signedTransaction, db, wallet } }) => {
					if (!signedTransaction) throw new Error("No signed transaction to send")
					return {
						signedTransaction,
						db,
						zeko: wallet.getSnapshot().context.currentNetwork.includes("zeko")
					}
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
							result: context.db.createResult({ hash: event.output.hash })
						}))
					}
				]
			}
		},
		WAITING: {
			description: "Wait for a transaction to be confirmed on L1.",
			invoke: {
				src: "waitForTransaction",
				input: ({ context: { sentTransaction, savedTransaction } }) => {
					if (savedTransaction) return { transaction: savedTransaction.hash }
					if (sentTransaction) return { transaction: sentTransaction }
					throw new Error("No sent transaction or savedTransaction.")
				},
				onDone: {
					target: "DONE",
					actions: enqueueActions(({ context, event, enqueue }) => {
						const { db } = context
						enqueue.assign({ result: db.createResult({ hash: event.output }) })
						db.confirmTransaction()
					})
				}
			}
		},
		DONE: { type: "final" }
	}
})
