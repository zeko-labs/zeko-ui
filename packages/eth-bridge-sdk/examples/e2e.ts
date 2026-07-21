import { PublicKey } from "o1js"
import {
	createPublicClient,
	createWalletClient,
	custom,
	type EIP1193Provider,
	erc20Abi,
	getAddress
} from "viem"
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

const account = getAddress(required("ETHEREUM_ACCOUNT"))
const transport = custom(provider)
const publicClient = createPublicClient({ transport })
const walletClient = createWalletClient({ transport })
const client = await EthereumBridgeClient.init({
	gatewayUrl: required("GATEWAY_URL"),
	provider,
	account,
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
} else if (command === "token-deposit") {
	const token = getAddress(required("ERC20_TOKEN_ADDRESS"))
	const amount = BigInt(required("ERC20_DEPOSIT_AMOUNT"))
	const approvalHash = await walletClient.writeContract({
		abi: erc20Abi,
		account,
		address: token,
		functionName: "approve",
		args: [client.config.bridgeAddress, amount],
		chain: null
	})
	const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash })
	if (approvalReceipt.status !== "success")
		throw new Error(`ERC20 approval ${approvalHash} reverted`)
	output = {
		approvalHash,
		...(await client.depositToken({
			token,
			recipient: PublicKey.fromBase58(required("ZEKO_RECIPIENT_PUBLIC_KEY")),
			amount
		}))
	}
} else if (command === "token-claim") {
	const withdrawal = await client.getTokenWithdrawal(
		Number(required("WITHDRAWAL_SETTLEMENT_SEQUENCE")),
		Number(required("WITHDRAWAL_OFFSET"))
	)
	const hash = await client.claimTokenWithdrawal(withdrawal)
	output = { hash, withdrawal }
} else if (command === "status") {
	output = await client.getDeposit(Number(required("DEPOSIT_NONCE")))
} else {
	throw new Error("Expected e2e command: deposit, claim, token-deposit, token-claim, or status")
}

const json = JSON.stringify(output, (_, value) =>
	typeof value === "bigint" ? value.toString() : value
)
if (Bun.env.E2E_OUTPUT) await Bun.write(Bun.env.E2E_OUTPUT, `${json}\n`)
console.log(json)
