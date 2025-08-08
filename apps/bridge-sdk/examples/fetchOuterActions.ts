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
		zekoUrl: "https://alphanet.zeko.io/graphql",
		l1Network: "testnet",
		l2Network: "testnet"
	})

	const actions = await bridge.fetchOuterActions(bridge.outerPk)
	console.log(
		actions.map((action) => {
			if (action.type === "commit") {
				return {
					type: action.type,
					ledger: action.ledger.toString(),
					innerActionState: action.innerActionState.toString(),
					innerActionStateLength: action.innerActionStateLength.toString(),
					synchronizedOuterActionState: action.synchronizedOuterActionState.toString(),
					synchronizedOuterActionStateLength: action.synchronizedOuterActionStateLength.toString(),
					action: action.action.action.map((x) => x.toString()),
					beforeActionState: action.action.beforeActionState.toString(),
					afterActionState: action.action.afterActionState.toString(),
					isPastWithdrawalDelay: action.isPastWithdrawalDelay,
					slotRange: {
						lower: action.slotRange.lower.toString(),
						upper: action.slotRange.upper.toString()
					}
				}
			}
			if (action.type === "witness") {
				return {
					type: action.type,
					action: action.action.action.map((x) => x.toString()),
					beforeActionState: action.action.beforeActionState.toString(),
					afterActionState: action.action.afterActionState.toString()
				}
			}
			throw new Error("should not be reachable")
		})
	)

	const deposits = await bridge.findDeposits(recipient)
	console.log(
		deposits.map(
			({
				recipient,
				amount,
				timeout,
				holderAccountL1,
				outerPk,
				beforeActionState,
				afterActionState,
				timedOut
			}) => ({
				recipient: recipient.toBase58(),
				amount: amount.toString(),
				timeout: timeout.toString(),
				holderAccountL1: holderAccountL1.toBase58(),
				outerPk: outerPk.toBase58(),
				beforeActionState: beforeActionState.toString(),
				afterActionState: afterActionState.toString(),
				timedOut
			})
		)
	)
}

main().catch(console.error)
