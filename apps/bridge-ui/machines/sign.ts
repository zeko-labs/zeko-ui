import type { ZkappCommand } from "@aurowallet/mina-provider"
import { assign, fromPromise, setup } from "xstate"
import { toQuietIfWalletRejection } from "~/errors"
import { createLogger } from "./debug"

const { act, logger } = createLogger("[SIGN]", { metrics: true })

const DUMMY_FEE_PAYER_AUTHORIZATION =
	"7mWxjLYgbJUkZNcGouvhVj5tJ8yu9hoexb9ntvPK8t5LHqzmrL6QJjjKtf5SgmxB4QWkDw7qoMMbbNGtHVpsbJHPyTy2EzRQ"

type SignMachineInput = {
	transaction: string
	user: string
}

type SignMachineContext = SignMachineInput & {
	signedTransaction: ZkappCommand | null
}

type SignMachineOutput = {
	signedTransaction: ZkappCommand
}

const signZkappTransaction = async ({
	transaction,
	user
}: SignMachineInput): Promise<ZkappCommand> => {
	const originalTransaction = JSON.parse(transaction) as ZkappCommand
	logger.info({ originalTransaction })

	if (originalTransaction.feePayer.body.fee === "0") {
		originalTransaction.feePayer.body.fee = "1"
	}

	let result: Awaited<ReturnType<typeof window.mina.sendTransaction>>
	try {
		result = await window.mina.sendTransaction({
			onlySign: true,
			transaction: JSON.stringify(originalTransaction)
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
		})
	}
}).createMachine({
	id: "sign",
	initial: "SIGNING",
	context: ({ input }) => ({
		...input,
		signedTransaction: null
	}),
	output: ({ context }) => {
		if (!context.signedTransaction) throw new Error("Transaction signing failed")
		return { signedTransaction: context.signedTransaction }
	},
	states: {
		SIGNING: {
			invoke: {
				src: "signTransaction",
				input: ({ context: { transaction, user } }) => ({ transaction, user }),
				onDone: {
					target: "DONE",
					actions: assign({ signedTransaction: ({ event }) => event.output })
				}
			}
		},
		DONE: { type: "final" }
	}
})
