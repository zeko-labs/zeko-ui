import type { ZkappCommand } from "@aurowallet/mina-provider"
import { assign, fromPromise, setup } from "xstate"
import { toQuietIfWalletRejection } from "~/errors"
import { createLogger } from "./debug"

const { act, logger } = createLogger("[SIGN]", { metrics: true })

const DUMMY_FEE_PAYER_AUTHORIZATION =
	"7mWxjLYgbJUkZNcGouvhVj5tJ8yu9hoexb9ntvPK8t5LHqzmrL6QJjjKtf5SgmxB4QWkDw7qoMMbbNGtHVpsbJHPyTy2EzRQ"

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
	if (!originalTransaction) return transaction

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

type SignMachineInput = {
	transaction: string
	user: string
	complete?: {
		requestId: string
		completeSignedTransaction: ({
			requestId,
			signedTransaction
		}: {
			requestId: string
			signedTransaction: ZkappCommand
		}) => Promise<string>
	}
}

type SignMachineContext = SignMachineInput & {
	signedTransaction: ZkappCommand | null
	transactionResult: string | null
}

type SignMachineOutput = {
	signedTransaction: ZkappCommand
	transaction?: string
}

const signZkappTransaction = async ({
	transaction,
	user
}: SignMachineInput): Promise<ZkappCommand> => {
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

export const signMachine = setup({
	types: {
		context: {} as SignMachineContext,
		input: {} as SignMachineInput,
		output: {} as SignMachineOutput
	},
	actors: {
		signTransaction: fromPromise<ZkappCommand, SignMachineInput>(({ input }) => {
			return act(
				"signTransaction",
				async () => {
					return signZkappTransaction(input)
				},
				input.user
			)
		}),
		completeSignature: fromPromise<
			string,
			NonNullable<SignMachineInput["complete"]> & { signedTransaction: ZkappCommand }
		>(({ input }) => {
			return input.completeSignedTransaction({
				requestId: input.requestId,
				signedTransaction: input.signedTransaction
			})
		})
	}
}).createMachine({
	id: "sign",
	initial: "SIGNING",
	context: ({ input }) => ({
		...input,
		signedTransaction: null,
		transactionResult: null
	}),
	output: ({ context }) => {
		if (!context.signedTransaction) throw new Error("Transaction signing failed")
		return {
			signedTransaction: context.signedTransaction,
			...(context.transactionResult ? { transaction: context.transactionResult } : {})
		}
	},
	states: {
		SIGNING: {
			invoke: {
				src: "signTransaction",
				input: ({ context: { transaction, user } }) => ({ transaction, user }),
				onDone: [
					{
						target: "COMPLETING",
						guard: ({ context }) => context.complete !== undefined,
						actions: assign({ signedTransaction: ({ event }) => event.output })
					},
					{
						target: "DONE",
						actions: assign({ signedTransaction: ({ event }) => event.output })
					}
				]
			}
		},
		COMPLETING: {
			invoke: {
				src: "completeSignature",
				input: ({ context }) => {
					if (!context.complete) throw new Error("No signature completion found")
					if (!context.signedTransaction) throw new Error("No signed transaction found")
					return {
						...context.complete,
						signedTransaction: context.signedTransaction
					}
				},
				onDone: {
					target: "DONE",
					actions: assign({ transactionResult: ({ event }) => event.output })
				}
			}
		},
		DONE: { type: "final" }
	}
})
