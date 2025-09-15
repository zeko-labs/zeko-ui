import { env } from "node:process"
import { PrivateKey } from "o1js"
import { Bridge } from "../src/index"
import { writeLog } from "./write-log"

if (!env.MINA_PRIVATE_KEY) {
	throw new Error("MINA_PRIVATE_KEY is not set")
}

const signer = PrivateKey.fromBase58(env.MINA_PRIVATE_KEY)
const recipient = signer.toPublicKey()

async function main() {
	const bridge = await Bridge.init({
		l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
		l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
		zekoUrl: "https://testnet.zeko.io/graphql",
		zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql",
		l1Network: "testnet",
		l2Network: "testnet"
	})

	const actions = await bridge.fetchOuterActionsWithStates(recipient)
	const formattedActions = actions.map((action, index) => {
		if (action.type === "commit") {
			return {
				index,
				type: action.type,
				// ledger: action.ledger.toString(),
				// innerActionState: action.innerActionState.toString(),
				// innerActionStateLength: action.innerActionStateLength.toString(),
				// synchronizedOuterActionState: action.synchronizedOuterActionState.toString(),
				synchronizedOuterActionStateLength: action.synchronizedOuterActionStateLength.toString(),
				// action: action.action.action.map((x) => x.toString()),
				// beforeActionState: action.action.beforeActionState.toString(),
				// afterActionState: action.action.afterActionState.toString(),
				// isPastWithdrawalDelay: action.isPastWithdrawalDelay,
				// slotRange: {
				// 	lower: action.slotRange.lower.toString(),
				// 	upper: action.slotRange.upper.toString()
				// },
				synced: action.synced,
				accepted: action.accepted,
				confirmed: action.confirmed,
				transaction: {
					hash: action.action.hash,
					status: action.action.status,
					timestamp: action.action.timestamp
				}
			}
		}
		if (action.type === "witness") {
			return {
				index,
				type: action.type,
				action: action.action.action.map((x) => x.toString()),
				beforeActionState: action.action.beforeActionState.toString(),
				afterActionState: action.action.afterActionState.toString(),
				deposit: action.deposit
					? {
							recipient: action.deposit.recipient.toBase58(),
							amount: action.deposit.amount.toString(),
							timeout: action.deposit.timeout.toString(),
							holderAccountL1: action.deposit.holderAccountL1.toBase58(),
							timedOut: action.deposit.timedOut,
							finalised: action.deposit.finalised
						}
					: undefined,
				transaction: {
					hash: action.action.hash,
					status: action.action.status,
					timestamp: action.action.timestamp
				},
				synced: action.synced,
				accepted: action.accepted,
				confirmed: action.confirmed
			}
		}
		throw new Error("should not be reachable")
	})

	console.log(formattedActions)
	writeLog({ log: formattedActions, name: "outer-actions" })
}

main().catch(console.error)
