import {
	AccountUpdate,
	Bool,
	Field,
	Int64,
	Mina,
	type PrivateKey,
	PublicKey,
	Sign,
	UInt64,
	fetchAccount
} from "o1js"
import { prefixes } from "../node_modules/o1js/dist/node/bindings/crypto/constants"
import {
	emptyHashWithPrefix,
	hashWithPrefix
} from "../node_modules/o1js/dist/node/lib/provable/crypto/poseidon"

export async function sendPayment({
	address,
	privateKey,
	amount,
	publicKey
}: {
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
		nonce
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

		const event = [
			Field("0"), // Claim
			Field("1"), // EventId
			...claimer.toFields(),
			Field(amount) // Amount
		]

		sender.body.events = createEvent(event)
		sender.requireSignature()
		receiver.balanceChange = Int64.create(amount64, Sign.one)
		receiver.body.implicitAccountCreationFee = new Bool(true)
	})

	const result = await tx.sign([privateKey]).send()
	return result
}
