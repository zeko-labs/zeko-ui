import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { Networks } from "@lumina-dex/sdk"
import { assign, fromPromise, setup } from "xstate"
import { toQuietIfWalletRejection } from "~/errors"
import { createLogger } from "./debug"
import { createExplorerUrl } from "./helpers"
import { sendMetric } from "./metrics"
import type { SdkSignatureRequest } from "./operations.worker"

const { act, logger } = createLogger("[TRANSACTION]", { metrics: true })

const DUMMY_FEE_PAYER_AUTHORIZATION =
	"7mWxjLYgbJUkZNcGouvhVj5tJ8yu9hoexb9ntvPK8t5LHqzmrL6QJjjKtf5SgmxB4QWkDw7qoMMbbNGtHVpsbJHPyTy2EzRQ"

export const DEFAULT_TRANSACTION_FEE_NANOMINA = 0.1 * 10e8
export const MAX_FEE_RETRIES = 5

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

const isZkappCommand = (value: unknown): value is ZkappCommand => {
	if (!isRecord(value)) return false
	const feePayer = value.feePayer
	if (!isRecord(feePayer)) return false
	const body = feePayer.body
	if (!isRecord(body)) return false
	return typeof body.fee === "string" && typeof body.publicKey === "string"
}

const parseZkappCommand = (transaction: string): ZkappCommand | null => {
	try {
		const parsed = JSON.parse(transaction) as unknown
		return isZkappCommand(parsed) ? parsed : null
	} catch {
		return null
	}
}

const normalizeWalletTransaction = (transaction: string): string => {
	const originalTransaction = parseZkappCommand(transaction)
	if (!originalTransaction) {
		throw new Error("Wallet signing requires a JSON zkApp transaction payload")
	}

	logger.info({ originalTransaction })

	if (originalTransaction.feePayer.body.fee !== "0") {
		return transaction
	}

	return JSON.stringify({
		...originalTransaction,
		feePayer: {
			...originalTransaction.feePayer,
			body: {
				...originalTransaction.feePayer.body,
				fee: "1"
			}
		}
	})
}

const isFeeTooLowError = (error: unknown): boolean => String(error).includes("Fee is too low")

const resultFromHash = ({ network, hash }: { network: Networks; hash: string }): Result => ({
	hash,
	url: createExplorerUrl({ network, hash })
})

const signZkappTransaction = async ({
	transaction,
	user
}: {
	transaction: string
	user: string
}): Promise<ZkappCommand> => {
	const walletTransaction = normalizeWalletTransaction(transaction)

	let result: Awaited<ReturnType<typeof window.mina.sendTransaction>>
	try {
		result = await window.mina.sendTransaction({
			onlySign: true,
			transaction: walletTransaction
		})
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		if (/Method not found/i.test(msg)) {
			throw new Error(
				"Your wallet does not support this operation. Please update your Auro Wallet extension to the latest version."
			)
		}
		throw toQuietIfWalletRejection(error)
	}

	if (result instanceof Error) throw toQuietIfWalletRejection(result)
	if ("signedData" in result) {
		const parsedSignedData = JSON.parse(result.signedData) as { zkappCommand: ZkappCommand }
		const zkappCommand = parsedSignedData.zkappCommand

		if (zkappCommand.feePayer.body.publicKey !== user) {
			zkappCommand.feePayer.authorization = DUMMY_FEE_PAYER_AUTHORIZATION
		}

		logger.success({ zkappCommand })
		return zkappCommand
	}

	throw new Error("Couldn't find signedData")
}

export type Result = { hash: string; url: ReturnType<typeof createExplorerUrl> }

export type TransactionMachineInput = {
	id: string
	key: string
	user: string
	network: Networks
	initialFeeNanomina?: number
	createSdkSignature: (input: { feeNanomina: number }) => Promise<SdkSignatureRequest>
	completeSdkSignature: (input: {
		requestId: string
		signedTransaction: ZkappCommand
	}) => Promise<string>
	rejectSdkSignature?: (input: { requestId: string; message?: string }) => Promise<void> | void
}

type TransactionMachineContext = TransactionMachineInput & {
	feeNanomina: number
	retryCount: number
	request: SdkSignatureRequest | null
	signedTransaction: ZkappCommand | null
	result: Result | Error | null
}

type TransactionMachineOutput = { result: Result; signedTransaction: ZkappCommand }

const assignError = (error: unknown) => ({
	result: error instanceof Error ? error : new Error(String(error))
})

const rejectCurrentSdkSignature = ({
	context,
	event
}: {
	context: TransactionMachineContext
	event: { error?: unknown }
}) => {
	if (!context.request || !context.rejectSdkSignature) return
	const error = event.error instanceof Error ? event.error : new Error(String(event.error))
	void context.rejectSdkSignature({ requestId: context.request.requestId, message: error.message })
}

export const transactionMachine = setup({
	types: {
		context: {} as TransactionMachineContext,
		input: {} as TransactionMachineInput,
		output: {} as TransactionMachineOutput
	},
	actors: {
		createSdkSignature: fromPromise<
			SdkSignatureRequest,
			Pick<TransactionMachineInput, "createSdkSignature" | "user"> & { feeNanomina: number }
		>(({ input }) =>
			act(
				"createSdkSignature",
				async () => input.createSdkSignature({ feeNanomina: input.feeNanomina }),
				input.user
			)
		),
		signTransaction: fromPromise<ZkappCommand, { transaction: string; user: string }>(({ input }) =>
			act("signTransaction", async () => signZkappTransaction(input), input.user)
		),
		completeSdkSignature: fromPromise<
			string,
			Pick<TransactionMachineInput, "completeSdkSignature" | "user"> & {
				requestId: string
				signedTransaction: ZkappCommand
			}
		>(({ input }) =>
			act(
				"completeSdkSignature",
				async () =>
					input.completeSdkSignature({
						requestId: input.requestId,
						signedTransaction: input.signedTransaction
					}),
				input.user
			)
		)
	}
}).createMachine({
	id: "transaction",
	initial: "CREATE_REQUEST",
	context: ({ input }) => ({
		...input,
		feeNanomina: input.initialFeeNanomina ?? DEFAULT_TRANSACTION_FEE_NANOMINA,
		retryCount: 0,
		request: null,
		signedTransaction: null,
		result: null
	}),
	output: ({ context }) => {
		if (context.result instanceof Error) throw context.result
		if (!context.result) throw new Error("Transaction failed")
		if (!context.signedTransaction) throw new Error("Transaction signing failed")
		return { result: context.result, signedTransaction: context.signedTransaction }
	},
	states: {
		CREATE_REQUEST: {
			invoke: {
				src: "createSdkSignature",
				input: ({ context }) => ({
					createSdkSignature: context.createSdkSignature,
					feeNanomina: context.feeNanomina,
					user: context.user
				}),
				onDone: {
					target: "SIGN",
					actions: assign({ request: ({ event }) => event.output })
				},
				onError: {
					target: "FAILED",
					actions: assign(({ event }) => assignError(event.error))
				}
			}
		},
		SIGN: {
			invoke: {
				src: "signTransaction",
				input: ({ context }) => {
					if (!context.request) throw new Error("No SDK signature request found")
					return { transaction: context.request.transaction, user: context.user }
				},
				onDone: {
					target: "COMPLETE",
					actions: assign({ signedTransaction: ({ event }) => event.output })
				},
				onError: {
					target: "FAILED",
					actions: [rejectCurrentSdkSignature, assign(({ event }) => assignError(event.error))]
				}
			}
		},
		COMPLETE: {
			invoke: {
				src: "completeSdkSignature",
				input: ({ context }) => {
					if (!context.request) throw new Error("No SDK signature request found")
					if (!context.signedTransaction) throw new Error("No signed transaction found")
					return {
						completeSdkSignature: context.completeSdkSignature,
						requestId: context.request.requestId,
						signedTransaction: context.signedTransaction,
						user: context.user
					}
				},
				onDone: {
					target: "DONE",
					actions: assign(({ context, event }) => ({
						result: resultFromHash({ network: context.network, hash: event.output })
					}))
				},
				onError: [
					{
						target: "CREATE_REQUEST",
						guard: ({ context, event }) =>
							isFeeTooLowError(event.error) && context.retryCount < MAX_FEE_RETRIES,
						actions: assign(({ context }) => {
							const retryCount = context.retryCount + 1
							const feeNanomina = context.feeNanomina * 2
							sendMetric(
								{
									category: "transaction",
									action: "feeRetry",
									label: `retry:${retryCount},fee:${feeNanomina}`
								},
								context.user
							)
							return {
								retryCount,
								feeNanomina,
								request: null,
								signedTransaction: null
							}
						})
					},
					{
						target: "FAILED",
						actions: assign(({ event }) =>
							assignError(
								isFeeTooLowError(event.error)
									? new Error("Bridge encountered a fee error. Please try your transaction again.")
									: event.error
							)
						)
					}
				]
			}
		},
		DONE: { type: "final" },
		FAILED: { type: "final" }
	}
})
