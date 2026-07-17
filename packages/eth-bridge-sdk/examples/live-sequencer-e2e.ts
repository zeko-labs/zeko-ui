import { readFile } from "node:fs/promises"
import { PrivateKey, PublicKey, UInt64 } from "o1js"
import { type Address, type EIP1193Provider, getAddress } from "viem"
import { EthereumBridgeClient, packZekoAddress } from "../src/index"

type LiveHarness = {
	schemaVersion: 1
	sequencerGraphqlUrl: string
	l1GraphqlUrl: string
	outerPublicKey: string
	recipientPublicKey: string
	completionMarker: string
}

const required = (name: string): string => {
	const value = Bun.env[name]
	if (!value) throw new Error(`${name} is required`)
	return value
}

const readyPath = required("LIVE_SEQUENCER_READY_FILE")
const harness = JSON.parse(await readFile(readyPath, "utf8")) as LiveHarness
if (harness.schemaVersion !== 1) throw new Error("Unsupported live sequencer harness schema")

const privateKey = PrivateKey.fromBase58(required("MINA_PRIVATE_KEY"))
const recipient = privateKey.toPublicKey()
if (!recipient.equals(PublicKey.fromBase58(harness.recipientPublicKey)).toBoolean()) {
	throw new Error("MINA_PRIVATE_KEY does not match the live sequencer recipient")
}

const chainId = 31_337
const ethereumAccount = getAddress(
	Bun.env.ETHEREUM_ACCOUNT ?? "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
)
const withdrawalRecipient = getAddress(
	Bun.env.WITHDRAWAL_RECIPIENT ?? "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
)
const bridgeAddress = getAddress(required("BRIDGE_ADDRESS"))
const depositAmount = required("DEPOSIT_AMOUNT_ZEKO")
const withdrawalAmount = required("WITHDRAWAL_AMOUNT_ZEKO")
const gatewayOrigin = new URL(harness.l1GraphqlUrl).origin
const deposit = {
	nonce: 1,
	token: "0x0000000000000000000000000000000000000000",
	sender: ethereumAccount,
	zekoRecipient: packZekoAddress(recipient),
	ethereumAmount: (BigInt(depositAmount) * 1_000_000_000n).toString(),
	zekoAmount: depositAmount,
	timeout: 4_294_967_295,
	ethereumTransactionHash: `0x${"01".repeat(32)}`,
	ethereumFinalized: true,
	bridgeJobId: "live-ocaml-witness",
	bridgeJobStatus: "confirmed",
	outerActionSequence: 0,
	outerActionStateAfter: null,
	synchronizedSettlementSequence: 0,
	status: "synchronized",
	nextAction: "finalize_on_l2"
} as const

const gatewayFetch = Object.assign(
	async (...args: Parameters<typeof globalThis.fetch>) => {
		const [input, init] = args
		const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
		const url = new URL(target)
		if (url.origin !== gatewayOrigin) return fetch(input, init)

		if (url.pathname === "/v1/bridge/config") {
			return Response.json({
				schemaVersion: 1,
				chainId,
				bridgeAddress,
				settlementAddress: "0x0000000000000000000000000000000000000002",
				ethereumDecimals: 18,
				zekoNativeDecimals: 9,
				ethereumConfirmations: 1,
				withdrawalDelaySlots: 0,
				currentVirtualSlot: 2_147_483_647
			})
		}
		if (url.pathname === "/v1/bridge/deposits") return Response.json([deposit])
		if (url.pathname === "/v1/bridge/deposits/1") return Response.json(deposit)
		return fetch(input, init)
	},
	{ preconnect: globalThis.fetch.preconnect }
) satisfies typeof globalThis.fetch

const provider = {
	request: async ({ method }: { method: string }) => {
		if (method === "eth_chainId") return `0x${chainId.toString(16)}`
		if (method === "eth_accounts") return [ethereumAccount]
		throw new Error(`Unexpected live sequencer EIP-1193 method: ${method}`)
	}
} as EIP1193Provider

const client = await EthereumBridgeClient.init({
	gatewayUrl: gatewayOrigin,
	provider,
	account: ethereumAccount,
	expectedChainId: chainId,
	fetch: gatewayFetch,
	zeko: {
		zekoUrl: harness.sequencerGraphqlUrl,
		zekoArchiveUrl: harness.sequencerGraphqlUrl,
		actionsApi: required("ACTIONS_API_URL"),
		l1Network: "mainnet",
		l2Network: { custom: "zeko-testnet" },
		pollTimeout: 30 * 60 * 1_000,
		verbose: Bun.env.VERBOSE === "true"
	}
})
console.log("[live-sequencer-e2e] Ethereum bridge client initialized")

const preparation = await client.prepareDepositFinalization(recipient)
console.log("[live-sequencer-e2e] Deposit finalization prepared")
if (!preparation.available) {
	throw new Error(preparation.reason ?? "Deposit finalization is not available")
}

const signTransaction: Parameters<EthereumBridgeClient["finalizeDeposit"]>[1] = async (
	transaction
) => transaction.sign([privateKey])
const depositTransactionHash = await client.finalizeDeposit(recipient, signTransaction)
console.log("[live-sequencer-e2e] Deposit finalization submitted")
const withdrawalTransactionHash = await client.requestWithdrawal({
	feePayer: { sender: recipient, fee: 100_000_000 },
	sender: recipient,
	recipient: withdrawalRecipient as Address,
	amount: UInt64.from(withdrawalAmount),
	signTransaction
})
console.log("[live-sequencer-e2e] Withdrawal request submitted")

const output = {
	status: "passed",
	preparation,
	depositTransactionHash,
	withdrawalTransactionHash,
	recipient: recipient.toBase58(),
	withdrawalRecipient,
	withdrawalAmount
}
await Bun.write(harness.completionMarker, `${JSON.stringify(output)}\n`)
console.log(JSON.stringify(output))
