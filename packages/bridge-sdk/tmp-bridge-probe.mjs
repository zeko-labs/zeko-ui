import { Bridge } from "./dist/index.js"
import { PublicKey } from "o1js"

const timeout = setTimeout(() => {
	console.error("probe timed out")
	process.exit(124)
}, 45000)

try {
	const bridge = await Bridge.init({
		l1Url: "https://gateway.mina.devnet.zeko.io",
		l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
		zekoUrl: "https://testnet.zeko.io/graphql",
		zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql",
		actionsApi: "https://api.actions.zeko.io/graphql",
		l1Network: "testnet",
		l2Network: "testnet",
		pollTimeout: 3600000
	})
	const pk = PublicKey.fromBase58("B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq")
	const [currentSlot, deposits, canCancel, canFinalize] = await Promise.all([
		bridge.fetchCurrentSlot(),
		bridge.fetchDepositsWithStates(pk),
		bridge.canCancelDeposit(pk),
		bridge.canFinalizeDeposit(pk)
	])
	const unresolved = deposits.deposits
		.filter((d) => d.finalised === false && d.cancelled === false)
		.map((d) => ({
			index: d.index,
			hash: d.hash,
			accepted: d.accepted,
			confirmed: d.confirmed,
			cancellable: d.cancellable,
			timeout: d.timeout.toString(),
			timestamp: d.timestamp
		}))
	console.log(
		JSON.stringify(
			{ currentSlot: currentSlot.toString(), canCancel, canFinalize, unresolved },
			null,
			2
		)
	)
} finally {
	clearTimeout(timeout)
}
