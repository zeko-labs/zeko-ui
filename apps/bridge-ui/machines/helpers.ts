import type { walletMachine } from "@lumina-dex/sdk"
import type { Mina } from "o1js"
import type { ActorRefFromLogic } from "xstate"

type Wallet = ActorRefFromLogic<typeof walletMachine>

export const sendTransaction = async ({
	tx,
	wallet
}: { tx: Mina.Transaction<false, false> | string; wallet: Wallet }) => {
	const transaction = typeof tx === "string" ? tx : tx.toJSON()
	const updateResult = await window.mina.sendTransaction({ onlySign: false, transaction })
	if (updateResult instanceof Error) {
		console.error("Transaction failed", updateResult)
		throw updateResult
	}
	if ("hash" in updateResult) {
		const timestamp = Date.now()
		const { currentNetwork, account } = wallet.getSnapshot().context
		const hash = updateResult.hash
		const storageKey = `zeko-bridge-tx-${timestamp}-${currentNetwork}-${account}-${hash}`
		localStorage.setItem(
			storageKey,
			JSON.stringify({ timestamp, currentNetwork, account, hash, transaction })
		)
		console.log("Transaction sent and saved to localStorage", updateResult)
		const baseUrl = {
			"mina:devnet": "https://minascan.io/devnet",
			"mina:mainnet": "https://minascan.io/mainnet",
			"zeko:testnet": "https://zekoscan.io/testnet",
			"zeko:mainnet": "https://zekoscan.io/mainnet"
		} as const
		return {
			hash: updateResult.hash,
			url: `${baseUrl[currentNetwork]}/account/${updateResult.hash}/zk-txs` as const
		}
	}
	console.log("An unexpected transaction result was received", updateResult)
	throw new Error("Unexpected transaction result")
}
