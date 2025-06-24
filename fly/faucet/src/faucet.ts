import {
	AccountUpdate,
	Bool,
	Int64,
	Mina,
	PrivateKey,
	PublicKey,
	Sign,
	UInt64,
	fetchAccount
} from "o1js"
import { sequencerBaseUrl } from "./constants"
import { Faucet } from "./zkapp"

if (!process.env.ZEKO_FAUCET_SENDER_PRIVATE_KEY)
	throw new Error("set ZEKO_FAUCET_SENDER_PRIVATE_KEY env var")

const privateKey = PrivateKey.fromBase58(process.env.ZEKO_FAUCET_SENDER_PRIVATE_KEY)
const publicKey = privateKey.toPublicKey()
const network = Mina.Network(sequencerBaseUrl)
Mina.setActiveInstance(network)

if (!process.env.ZEKO_FAUCET_SEND_AMOUNT) throw new Error("set ZEKO_FAUCET_SEND_AMOUNT")

const amount_bigint = BigInt(process.env.ZEKO_FAUCET_SEND_AMOUNT)

export async function sendPayment(address: string) {
	const faucetAccount = await fetchAccount({ publicKey: publicKey })

	const nonce = Number(faucetAccount.account?.nonce || 0)

	const feePayer = {
		sender: publicKey,
		fee: 0.1 * 1e9,
		nonce: nonce,
	} satisfies Mina.FeePayerSpec

	const amount = new UInt64(amount_bigint)

	const tx = await Mina.transaction(feePayer, async () => {
		const sender = AccountUpdate.create(publicKey)
		const receiver = AccountUpdate.create(PublicKey.fromBase58(address))
		sender.balanceChange = Int64.create(amount, Sign.minusOne)
		sender.body.useFullCommitment = new Bool(true)
		sender.requireSignature()
		receiver.balanceChange = Int64.create(amount, Sign.one)
		receiver.body.implicitAccountCreationFee = new Bool(true)
		receiver.body.preconditions.account.balance.isSome = new Bool(true)
		receiver.body.preconditions.account.balance.value.lower = UInt64.zero
		receiver.body.preconditions.account.balance.value.upper = amount.sub(1)
	})

	const result = await tx.sign([privateKey]).send()
	return result
}

const zkFaucetAddress = new PublicKey("zkFaucetAddress")
// Replace with actual zkFaucet address
export async function sendZkPayment(address: string) {
	const zkFaucet = new Faucet(zkFaucetAddress)

	const feePayer = {
		sender: publicKey,
		fee: 0.1 * 1e9,
	} satisfies Mina.FeePayerSpec

	const transaction = await Mina.transaction(feePayer, async () => {
		AccountUpdate.fundNewAccount(feePayer.sender)
		await zkFaucet.claim(PublicKey.fromBase58(address))
	})

	await transaction.prove()
	const result = await transaction.sign([privateKey]).send()
	return result
}