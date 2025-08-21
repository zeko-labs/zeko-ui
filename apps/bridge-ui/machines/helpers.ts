import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { Networks, walletMachine } from "@lumina-dex/sdk"
import { type Mina, type PublicKey, Transaction } from "o1js"
import type { ActorRefFromLogic } from "xstate"

type Wallet = ActorRefFromLogic<typeof walletMachine>

const baseUrl = {
	"mina:devnet": "https://mxinascan.io/devnet",
	"mina:mainnet": "https://minascan.io/mainnet",
	"zeko:testnet": "https://zekoscan.io/testnet",
	"zeko:mainnet": "https://zekoscan.io/mainnet"
} as const
export const createExplorerUrl = ({ network, hash }: { network: Networks; hash: string }) =>
	`${baseUrl[network]}/account/${hash}/zk-txs` as const

export const sendTransaction = async ({
	tx,
	wallet,
	sender
}: { tx: Mina.Transaction<false, false> | string; wallet: Wallet; sender?: PublicKey }) => {
	const transaction = typeof tx === "string" ? tx : tx.toJSON()
	const result = await window.mina.sendTransaction({ onlySign: !!sender, transaction })

	if (result instanceof Error) {
		console.error("Transaction failed", result)
		throw result
	}

	const processHash = (hash: string) => {
		const timestamp = Date.now()
		const { currentNetwork, account } = wallet.getSnapshot().context
		const storageKey = `zeko-bridge-tx-${timestamp}-${currentNetwork}-${account}-${hash}`
		localStorage.setItem(
			storageKey,
			JSON.stringify({ timestamp, currentNetwork, account, hash, transaction })
		)
		console.log("Transaction sent and saved to localStorage", result)

		return { hash, url: createExplorerUrl({ network: currentNetwork, hash }) }
	}

	if ("hash" in result) return processHash(result.hash)

	// Transactions paid by another sender are signed, then sent with o1js
	if (sender && "signedData" in result) {
		const transaction = Transaction.fromJSON(JSON.parse(result.signedData) as ZkappCommand)
		const result2 = await transaction.send()
		return processHash(result2.hash)
	}

	console.log("An unexpected transaction result was received", result)
	throw new Error("Unexpected transaction result")
}
