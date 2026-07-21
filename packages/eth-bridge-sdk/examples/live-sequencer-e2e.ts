import { readFile, writeFile } from "node:fs/promises"
import { deployEthereumTokenMirror } from "@zeko-labs/bridge-sdk"
import { Field, fetchAccount, Mina, PrivateKey, PublicKey, UInt64, VerificationKey } from "o1js"
import { type Address, type EIP1193Provider, getAddress } from "viem"
import { EthereumBridgeClient, packZekoAddress } from "../dist/index.js"

type LiveHarness = {
	schemaVersion: 2
	sequencerGraphqlUrl: string
	l1GraphqlUrl: string
	outerPublicKey: string
	recipientPublicKey: string
	completionMarker: string
	ethereumTokenBridgeVerificationKey?: string
	ethereumTokenBridgeVerificationKeyHash?: string
}

const required = (name: string): string => {
	const value = process.env[name]
	if (!value) throw new Error(`${name} is required`)
	return value
}

const minaNetworkId = (value: string): "mainnet" | "testnet" | { custom: string } => {
	if (value === "mainnet" || value === "testnet") return value
	return { custom: value }
}

const readyPath = required("LIVE_SEQUENCER_READY_FILE")
const harness = JSON.parse(await readFile(readyPath, "utf8")) as LiveHarness
if (harness.schemaVersion !== 2) throw new Error("Unsupported live sequencer harness schema")

const privateKey = PrivateKey.fromBase58(required("MINA_PRIVATE_KEY"))
const recipient = privateKey.toPublicKey()
if (!recipient.equals(PublicKey.fromBase58(harness.recipientPublicKey)).toBoolean()) {
	throw new Error("MINA_PRIVATE_KEY does not match the live sequencer recipient")
}

const chainId = 31_337
const ethereumAccount = getAddress(
	process.env.ETHEREUM_ACCOUNT ?? "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
)
const withdrawalRecipient = getAddress(
	process.env.WITHDRAWAL_RECIPIENT ?? "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
)
const bridgeAddress = getAddress(required("BRIDGE_ADDRESS"))
const depositAmount = required("DEPOSIT_AMOUNT_ZEKO")
const withdrawalAmount = required("WITHDRAWAL_AMOUNT_ZEKO")
const bridgeAsset = process.env.BRIDGE_ASSET ?? "native"
if (bridgeAsset !== "native" && bridgeAsset !== "erc20") {
	throw new Error(`Unsupported BRIDGE_ASSET: ${bridgeAsset}`)
}
const tokenAddress =
	bridgeAsset === "erc20" ? getAddress(required("ERC20_TOKEN_ADDRESS")) : undefined
const assetId = bridgeAsset === "erc20" ? required("ERC20_ASSET_ID").toLowerCase() : undefined
const gatewayOrigin = new URL(harness.l1GraphqlUrl).origin
const l1Network = minaNetworkId(required("L1_NETWORK"))
const l2Network = minaNetworkId(required("L2_NETWORK"))
const deposit = {
	nonce: 1,
	token: tokenAddress ?? "0x0000000000000000000000000000000000000000",
	assetId: assetId ?? null,
	sender: ethereumAccount,
	zekoRecipient: packZekoAddress(recipient),
	ethereumAmount:
		bridgeAsset === "erc20" ? depositAmount : (BigInt(depositAmount) * 1_000_000_000n).toString(),
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
		l1Network,
		l2Network,
		pollTimeout: 30 * 60 * 1_000,
		verbose: process.env.VERBOSE === "true"
	}
})
console.log("[live-sequencer-e2e] Ethereum bridge client initialized")

const preparation =
	bridgeAsset === "erc20"
		? await client.prepareTokenDepositFinalization(recipient)
		: await client.prepareDepositFinalization(recipient)
console.log("[live-sequencer-e2e] Deposit finalization prepared")
if (!preparation.available) {
	throw new Error(preparation.reason ?? "Deposit finalization is not available")
}

const signTransaction: Parameters<EthereumBridgeClient["finalizeDeposit"]>[1] = async (
	transaction
) => transaction.sign([privateKey])
let tokenDeployment: Awaited<ReturnType<typeof deployEthereumTokenMirror>> | undefined
let tokenBalances: { vault: string; recipient: string } | undefined
let depositTransactionHash: string
let withdrawalTransactionHash: string

if (bridgeAsset === "erc20") {
	const config = client.ethereumToken
	if (!config) throw new Error("Live sequencer did not expose its ERC20 configuration")
	if (!tokenAddress || config.ethereumTokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) {
		throw new Error("Live sequencer ERC20 address does not match the scenario")
	}
	if (!assetId || config.assetId !== assetId) {
		throw new Error("Live sequencer ERC20 asset ID does not match the scenario")
	}
	const verificationKeyData = harness.ethereumTokenBridgeVerificationKey
	const verificationKeyHash = harness.ethereumTokenBridgeVerificationKeyHash
	if (!verificationKeyData || !verificationKeyHash) {
		throw new Error("Live sequencer did not publish its ERC20 bridge verification key")
	}
	const tokenOwnerKey = PrivateKey.fromBase58(required("ERC20_TOKEN_OWNER_PRIVATE_KEY"))
	const tokenVaultKey = PrivateKey.fromBase58(required("ERC20_TOKEN_VAULT_PRIVATE_KEY"))
	const adminContractKey = PrivateKey.fromBase58(required("ERC20_ADMIN_CONTRACT_PRIVATE_KEY"))
	const adminAuthorityKey = PrivateKey.fromBase58(required("ERC20_ADMIN_AUTHORITY_PRIVATE_KEY"))
	if (!tokenOwnerKey.toPublicKey().equals(config.tokenOwnerL2).toBoolean()) {
		throw new Error("ERC20_TOKEN_OWNER_PRIVATE_KEY does not match the circuit configuration")
	}
	if (!tokenVaultKey.toPublicKey().equals(config.holderAccountL2).toBoolean()) {
		throw new Error("ERC20_TOKEN_VAULT_PRIVATE_KEY does not match the circuit configuration")
	}
	Mina.setActiveInstance(
		Mina.Network({
			mina: harness.sequencerGraphqlUrl,
			archive: harness.sequencerGraphqlUrl,
			networkId: l2Network
		})
	)
	const inventory = UInt64.from(required("ERC20_DEPOSIT_CAP"))
	const bridgeVerificationKey = new VerificationKey({
		data: verificationKeyData,
		hash: Field(verificationKeyHash)
	})
	const signDeployment = async (transaction: Parameters<typeof signTransaction>[0]) =>
		transaction.sign([privateKey, tokenOwnerKey, adminContractKey])
	const signProvisioning = async (transaction: Parameters<typeof signTransaction>[0]) =>
		transaction.sign([privateKey, tokenVaultKey, adminContractKey, adminAuthorityKey])
	tokenDeployment = await deployEthereumTokenMirror({
		config,
		registration: {
			registered: true,
			allowed: true,
			assetId,
			ethereumTokenAddress: tokenAddress,
			zekoTokenOwnerL2: config.tokenOwnerL2,
			zekoTokenIdL2: config.tokenIdL2,
			zekoDecimals: 9,
			ethereumDecimals: 9,
			depositCap: inventory
		},
		bridgeVerificationKey,
		decimals: 9,
		inventory,
		feePayer: recipient,
		adminContractL2: adminContractKey.toPublicKey(),
		adminAuthorityL2: adminAuthorityKey.toPublicKey(),
		symbol: "ZP20",
		sourceUri: "https://zeko.invalid/local-erc20",
		signDeployment,
		signProvisioning,
		// The local sequencer applies sendZkapp synchronously but does not expose
		// Mina daemon bestChain, which is what o1js's default pending.wait() polls.
		waitForInclusion: async () => {}
	})
	console.log("[live-sequencer-e2e] ERC20 mirror deployed")
	depositTransactionHash = await client.finalizeTokenDeposit({
		feePayer: { sender: recipient, fee: 100_000_000 },
		recipient,
		signTransaction
	})
	console.log("[live-sequencer-e2e] ERC20 deposit finalization submitted")
	withdrawalTransactionHash = await client.requestTokenWithdrawal({
		feePayer: { sender: recipient, fee: 100_000_000 },
		sender: recipient,
		recipient: withdrawalRecipient as Address,
		amount: UInt64.from(withdrawalAmount),
		signTransaction
	})
	console.log("[live-sequencer-e2e] ERC20 withdrawal request submitted")
	await Promise.all([
		fetchAccount({ publicKey: config.holderAccountL2, tokenId: config.tokenIdL2 }),
		fetchAccount({ publicKey: recipient, tokenId: config.tokenIdL2 })
	])
	const expectedRecipient = BigInt(depositAmount) - BigInt(withdrawalAmount)
	const expectedVault = inventory.toBigInt() - BigInt(depositAmount) + BigInt(withdrawalAmount)
	const recipientBalance = Mina.getBalance(recipient, config.tokenIdL2).toBigInt()
	const vaultBalance = Mina.getBalance(config.holderAccountL2, config.tokenIdL2).toBigInt()
	if (recipientBalance !== expectedRecipient || vaultBalance !== expectedVault) {
		throw new Error(
			`Unexpected ERC20 L2 balances: recipient=${recipientBalance}, vault=${vaultBalance}`
		)
	}
	tokenBalances = { vault: vaultBalance.toString(), recipient: recipientBalance.toString() }
} else {
	depositTransactionHash = await client.finalizeDeposit(recipient, signTransaction)
	console.log("[live-sequencer-e2e] Deposit finalization submitted")
	withdrawalTransactionHash = await client.requestWithdrawal({
		feePayer: { sender: recipient, fee: 100_000_000 },
		sender: recipient,
		recipient: withdrawalRecipient as Address,
		amount: UInt64.from(withdrawalAmount),
		signTransaction
	})
	console.log("[live-sequencer-e2e] Withdrawal request submitted")
}

const output = {
	status: "passed",
	preparation,
	depositTransactionHash,
	withdrawalTransactionHash,
	recipient: recipient.toBase58(),
	withdrawalRecipient,
	withdrawalAmount,
	bridgeAsset,
	tokenDeployment,
	tokenBalances
}
await writeFile(harness.completionMarker, `${JSON.stringify(output)}\n`)
console.log(JSON.stringify(output))
