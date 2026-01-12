import type { ZkappCommand } from "@aurowallet/mina-provider"
import { type Networks, urls, type walletMachine } from "@lumina-dex/sdk"
import type { Mina } from "o1js"
import type { ActorRefFromLogic } from "xstate"
import { assign, enqueueActions, fromPromise, setup } from "xstate"
import { createLogger } from "./debug"
import { type HashDb, hashDb, type SavedTransaction } from "./helpers"
import type { OperationsWorker } from "./operations.worker"

const { act, logger } = createLogger("[TRANSACTION]")

const MAX_RETRIES = 5

type Wallet = ActorRefFromLogic<typeof walletMachine>

export type Result = ReturnType<HashDb["createResult"]>

type SentTransaction = { hash: string; zkAppId: string }

export type TransactionMachineContext = {
	id: string
	transaction: string
	wallet: Wallet
	worker: OperationsWorker
	user: string
	savedTransaction: SavedTransaction | null
	signedTransaction: ZkappCommand | null
	sentTransaction: SentTransaction | null
	result: Result | Error
	db: HashDb
	network: Networks
	retryCount: number
	feeMultiplier: number
}

type TransactionMachineInput = {
	id: string
	transaction: Mina.Transaction<false, false> | string
	wallet: Wallet
	worker: OperationsWorker
}

type TransactionMachineOutput = { result: Result }

type SendSignedTxInput = {
	zeko: boolean
	signedTransaction: ZkappCommand
	db: HashDb
	worker: OperationsWorker
	feeMultiplier: number
}

type WaitForTxInput = SentTransaction & { network: Networks; worker: OperationsWorker }

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
					logger.info({ originalTransaction })
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
						// biome-ignore lint/suspicious/noExplicitAny: Parsing without validating
						const zkappCommand = (JSON.parse(result.signedData) as any).zkappCommand as ZkappCommand
						// If the feePayer is not the user, we need to set the authorization to a dummy value
						if (zkappCommand.feePayer.body.publicKey !== user) {
							zkappCommand.feePayer.authorization =
								"7mWxjLYgbJUkZNcGouvhVj5tJ8yu9hoexb9ntvPK8t5LHqzmrL6QJjjKtf5SgmxB4QWkDw7qoMMbbNGtHVpsbJHPyTy2EzRQ"
						}
						logger.success({ zkappCommand })
						return zkappCommand
					}
					throw new Error("Couldn't find signedData")
				})
			}
		),
		sendSignedTransaction: fromPromise<SentTransaction, SendSignedTxInput>(({ input }) => {
			return act("sendSignedTransaction", async () => {
				const { signedTransaction, db, zeko, worker, feeMultiplier } = input
				const zkappCommand = structuredClone(signedTransaction)

				if (feeMultiplier > 1) {
					const currentFee = BigInt(zkappCommand.feePayer.body.fee)
					const newFee = currentFee * BigInt(feeMultiplier)
					zkappCommand.feePayer.body.fee = newFee.toString()
					logger.info(`Adjusted fee by ${feeMultiplier}x: ${currentFee} -> ${newFee}`)
				}

				const { hash, zkAppId } = await worker.sendZkAppCommand(zkappCommand)
				logger.success("Transaction sent", hash)
				await db.saveSigned({ hash, zkAppId, confirmed: zeko, zkappCommand })
				return { hash, zkAppId }
			})
		}),
		waitForTransaction: fromPromise<string, WaitForTxInput>(({ input }) => {
			return act("waitForTransaction", async () => {
				const { zkAppId, hash, worker, network } = input
				const transactionStatus = async (delay = 2000) => {
					const url = urls[network]
					const result = await worker.transactionStatus({ zkAppId, url })
					if (result === "PENDING") {
						await new Promise((r) => setTimeout(r, delay))
						return transactionStatus(delay)
					}
					if (result === "INCLUDED") return true
					throw new Error("Transactions status is unknown.")
				}
				await transactionStatus()
				logger.success("Transaction included:", hash)
				return hash
			})
		})
	}
}).createMachine({
	id: "transaction",
	initial: "RESUMING",
	context: ({ input: { id, transaction: tx, wallet, worker } }) => {
		const transaction = typeof tx === "string" ? tx : tx.toJSON()
		const { account, currentNetwork: network } = wallet.getSnapshot().context
		return {
			id,
			transaction,
			wallet,
			worker,
			user: account,
			savedTransaction: null,
			signedTransaction: null,
			sentTransaction: null,
			result: new Error("Transaction failed"),
			db: hashDb({ network, account, transaction }),
			network,
			retryCount: 0,
			feeMultiplier: 1
		}
	},
	output: ({ context: { result } }) => {
		if (result instanceof Error) throw result
		return { result }
	},
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
				input: ({ context: { signedTransaction, db, network, worker, feeMultiplier } }) => {
					if (!signedTransaction) throw new Error("No signed transaction to send")
					return {
						signedTransaction,
						db,
						worker,
						zeko: network.includes("zeko"),
						feeMultiplier
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
				],
				onError: [
					{
						target: "SENDING",
						guard: ({ context, event }) => {
							const isFeeError = String(event.error).includes("Fee is too low")
							return isFeeError && context.retryCount < MAX_RETRIES
						},
						actions: assign(({ context }) => ({
							retryCount: context.retryCount + 1,
							feeMultiplier: context.feeMultiplier * 2
						}))
					},
					{
						target: "DONE",
						actions: assign(({ event }) => ({
							result: String(event.error).includes("Fee is too low")
								? new Error("Bridge encountered a fee error. Please try your transaction again.")
								: event.error instanceof Error
									? event.error
									: new Error(String(event.error))
						}))
					}
				]
			}
		},
		WAITING: {
			description: "Wait for a transaction to be confirmed on L1.",
			invoke: {
				src: "waitForTransaction",
				input: ({ context: { sentTransaction, worker, network } }) => {
					if (sentTransaction) return { ...sentTransaction, worker, network }
					throw new Error("No sent transaction was found.")
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
