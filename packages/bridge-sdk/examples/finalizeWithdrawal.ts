import { env } from "node:process"
import { PrivateKey } from "o1js"
import { Bridge } from "../src/index"

if (!env.MINA_PRIVATE_KEY) {
	throw new Error("MINA_PRIVATE_KEY is not set")
}

const signer = PrivateKey.fromBase58(env.MINA_PRIVATE_KEY)
const recipient = signer.toPublicKey()

async function main() {
	const bridge = await Bridge.init({
		l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
		l1ArchiveUrl: "https://devnet-archive-node-api.gcp.o1test.net/",
		actionsApi: "http://localhost:9100/graphql",
		zekoUrl: "https://alphanet.zeko.io/graphql",
		zekoArchiveUrl: "https://archive.alphanet.zeko.io/graphql",
		l1Network: "testnet",
		l2Network: "testnet"
	})

	const txnHash = await bridge.finalizeWithdrawal(
		recipient,
		async (txn) => {
			console.log(txn.toJSON())
			return txn.sign([signer])
		},
		bridge.outerHolders[0]
	)

	console.log(txnHash)
}

main().catch(console.error)
