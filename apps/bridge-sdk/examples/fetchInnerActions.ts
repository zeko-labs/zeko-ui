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
		l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
		zekoUrl: "https://devnet.zeko.io/graphql",
		l1Network: "testnet",
		l2Network: "testnet"
	})

	const actions = await bridge.fetchInnerActionsWithStates(recipient)
	console.log(
		actions.map(
			({
				action: { action, beforeActionState, afterActionState },
				type,
				withdrawal,
				committed,
				isPastWithdrawalDelay
			}) => ({
				type,
				action: action.map((x) => x.toString()),
				beforeActionState: beforeActionState.toString(),
				afterActionState: afterActionState.toString(),
				withdrawal: withdrawal
					? {
							recipient: withdrawal.recipient.toBase58(),
							amount: withdrawal.amount.toString(),
							finalised: withdrawal.finalised
						}
					: undefined,
				committed,
				isPastWithdrawalDelay
			})
		)
	)
}

main().catch(console.error)
