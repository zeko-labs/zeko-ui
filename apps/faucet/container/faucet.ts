import {
	AccountUpdate,
	Bool,
	Field,
	Int64,
	Mina,
	type PrivateKey,
	PublicKey,
	Sign,
	UInt32,
	UInt64,
	fetchAccount
} from "o1js"
import { prefixes } from "./node_modules/o1js/dist/node/bindings/crypto/constants"
import { emptyHashWithPrefix, hashWithPrefix } from "./node_modules/o1js/dist/node/lib/provable/crypto/poseidon"

async function getCurrentSlot() {
	const response = await fetch("https://devnet.zeko.io/graphql", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query: `
        query RuntimeConfig { runtimeConfig }
      `,
			variables: {}
		})
	})
	const { data: { runtimeConfig } } = await response.json()

	const currentTimestamp = Date.now() / 1000
	const forkSlot = runtimeConfig.proof.fork.global_slot_since_genesis
	const genesisTimestamp = Date.parse(runtimeConfig.genesis.genesis_state_timestamp) / 1000

	return UInt32.from(Math.floor(forkSlot + ((currentTimestamp - genesisTimestamp) / 180)))
}

export async function sendPayment({ address, privateKey, amount, publicKey }: {
	address: string
	privateKey: PrivateKey
	amount: bigint
	publicKey: PublicKey
}) {
	const claimer = PublicKey.fromBase58(address)

	const faucetAccount = await fetchAccount({ publicKey: publicKey })
	const nonce = Number(faucetAccount.account?.nonce || 0)

	const feePayer = {
		sender: publicKey,
		fee: 0.1 * 1e9,
		nonce,
	} satisfies Mina.FeePayerSpec

	const amount64 = new UInt64(amount)

	const tx = await Mina.transaction(feePayer, async () => {
		const sender = AccountUpdate.create(publicKey)
		const receiver = AccountUpdate.create(claimer)
		sender.balanceChange = Int64.create(amount64, Sign.minusOne)
		sender.body.useFullCommitment = new Bool(true)

		const createEvent = (event: Field[]) => {
			const emptyEvent = { hash: emptyHashWithPrefix("MinaZkappEventsEmpty"), data: [] }
			const eventHash = hashWithPrefix(prefixes.event, event)
			const hash = hashWithPrefix(prefixes.events, [emptyEvent.hash, eventHash])
			return { hash, data: [event, ...emptyEvent.data] }
		}
		const currentSlot = await getCurrentSlot()
		const event = [
			Field("0"), // Claim 
			Field("1"), // EventId
			...claimer.toFields(), // Claimer PublicKey
			Field(amount), // Amount
			Field(currentSlot.toBigint()) // Current Slot
		]

		sender.body.events = createEvent(event)
		sender.requireSignature()
		receiver.balanceChange = Int64.create(amount64, Sign.one)
		receiver.body.implicitAccountCreationFee = new Bool(true)
	})

	const result = await tx.sign([privateKey]).send()
	return result
}