import { PublicKey } from "o1js"
import { type EIP1193Provider, getAddress } from "viem"
import { EthereumBridgeClient } from "../src/index"

const required = (name: string): string => {
	const value = Bun.env[name]
	if (!value) throw new Error(`${name} is required`)
	return value
}

let requestId = 0
const rpcUrl = required("RPC_URL")
const provider = {
	request: async ({ method, params }: { method: string; params?: unknown }) => {
		const response = await fetch(rpcUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params: params ?? [] })
		})
		const body = (await response.json()) as { result?: unknown; error?: { message?: string } }
		if (body.error) throw new Error(body.error.message ?? `JSON-RPC ${method} failed`)
		return body.result
	}
} as EIP1193Provider

const client = await EthereumBridgeClient.init({
	gatewayUrl: required("GATEWAY_URL"),
	provider,
	account: getAddress(required("ETHEREUM_ACCOUNT")),
	expectedChainId: Number(required("CHAIN_ID"))
})

const command = Bun.argv[2]
let output: unknown
if (command === "deposit") {
	output = await client.depositNative({
		recipient: PublicKey.fromBase58(required("ZEKO_RECIPIENT_PUBLIC_KEY")),
		valueWei: BigInt(required("DEPOSIT_VALUE_WEI"))
	})
} else if (command === "claim") {
	const withdrawals = await client.listWithdrawals({
		recipient: getAddress(required("WITHDRAWAL_RECIPIENT"))
	})
	const withdrawal = withdrawals[0]
	if (!withdrawal) throw new Error("No native withdrawal found")
	const hash = await client.claimNativeWithdrawal(withdrawal)
	output = { hash, withdrawal }
} else if (command === "status") {
	output = await client.getDeposit(Number(required("DEPOSIT_NONCE")))
} else {
	throw new Error("Expected e2e command: deposit, status, or claim")
}

const json = JSON.stringify(output, (_, value) =>
	typeof value === "bigint" ? value.toString() : value
)
if (Bun.env.E2E_OUTPUT) await Bun.write(Bun.env.E2E_OUTPUT, `${json}\n`)
console.log(json)
