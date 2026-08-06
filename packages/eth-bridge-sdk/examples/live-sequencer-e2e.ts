import { access, readFile, writeFile } from "node:fs/promises"
import { deployEthereumTokenMirror } from "@zeko-labs/bridge-sdk"
import { Field, fetchAccount, Mina, PrivateKey, PublicKey, UInt64, VerificationKey } from "o1js"
import { type Address, type EIP1193Provider, getAddress, type Hex } from "viem"
import {
	type DepositStatus,
	type EthereumAssetRecord,
	EthereumBridgeClient,
	ethereumTokenDepositSelection,
	packZekoAddress
} from "../dist/index.js"

type LiveHarness = {
	schemaVersion: 3
	sequencerGraphqlUrl: string
	l1GraphqlUrl: string
	outerPublicKey: string
	recipientPublicKey: string
	registrationCompletionMarker: string
	operationsReadyMarker: string
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

const waitForFile = async (path: string): Promise<void> => {
	const deadline = Date.now() + 45 * 60 * 1_000
	while (Date.now() < deadline) {
		try {
			await access(path)
			return
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	}
	throw new Error(`Timed out waiting for ${path}`)
}

const retry = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
	const deadline = Date.now() + 2 * 60 * 1_000
	let lastError: unknown
	while (Date.now() < deadline) {
		try {
			return await operation()
		} catch (error) {
			lastError = error
			await new Promise((resolve) => setTimeout(resolve, 1_000))
		}
	}
	throw new Error(`${label} timed out`, { cause: lastError })
}

const readyPath = required("LIVE_SEQUENCER_READY_FILE")
const harness = JSON.parse(await readFile(readyPath, "utf8")) as LiveHarness
if (harness.schemaVersion !== 3) throw new Error("Unsupported live sequencer harness schema")

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

const assetRecord = (index: number): EthereumAssetRecord => {
	const prefix = `ERC20_TOKEN_${index}_`
	return {
		schemaVersion: 1,
		registryIndex: index,
		assetId: required(`${prefix}ASSET_ID`) as Hex,
		ethereumTokenAddress: getAddress(required(`${prefix}ADDRESS`)),
		tokenOwnerL2: required(`${prefix}OWNER_PACKED`) as Hex,
		tokenIdL2: required(`${prefix}TOKEN_ID`) as Hex,
		decimals: 9,
		inventoryCap: BigInt(required(`${prefix}DEPOSIT_CAP`)),
		mftStandardVkId: required("ERC20_MFT_STANDARD_VK_ID") as Hex,
		vaultPublicKey: required("ERC20_SHARED_VAULT_PACKED") as Hex,
		universalBridgeVkId: required("ERC20_UNIVERSAL_BRIDGE_VK_ID") as Hex
	}
}

const assets = bridgeAsset === "erc20" ? [assetRecord(0), assetRecord(1)] : []
const deposits: DepositStatus[] = assets.map((asset, index) => ({
	nonce: index + 1,
	token: asset.ethereumTokenAddress,
	assetId: asset.assetId.toLowerCase() as Hex,
	sender: ethereumAccount,
	zekoRecipient: packZekoAddress(recipient),
	ethereumAmount: depositAmount,
	zekoAmount: depositAmount,
	timeout: 4_294_967_295,
	ethereumTransactionHash: `0x${(index + 1).toString(16).padStart(2, "0").repeat(32)}`,
	ethereumFinalized: true,
	encodingVersion: 2,
	bridgeJobId: `live-ocaml-witness-${index}`,
	bridgeJobStatus: "confirmed",
	outerActionSequence: index,
	outerActionStateAfter: null,
	synchronizedSettlementSequence: 0,
	status: "synchronized",
	nextAction: "finalize_on_l2"
}))
if (bridgeAsset === "native") {
	deposits.push({
		nonce: 1,
		token: "0x0000000000000000000000000000000000000000",
		assetId: null,
		sender: ethereumAccount,
		zekoRecipient: packZekoAddress(recipient),
		ethereumAmount: (BigInt(depositAmount) * 1_000_000_000n).toString(),
		zekoAmount: depositAmount,
		timeout: 4_294_967_295,
		ethereumTransactionHash: `0x${"01".repeat(32)}`,
		ethereumFinalized: true,
		encodingVersion: null,
		bridgeJobId: "live-ocaml-witness",
		bridgeJobStatus: "confirmed",
		outerActionSequence: 0,
		outerActionStateAfter: null,
		synchronizedSettlementSequence: 0,
		status: "synchronized",
		nextAction: "finalize_on_l2"
	})
}

const gatewayOrigin = new URL(harness.l1GraphqlUrl).origin
const l1Network = minaNetworkId(required("L1_NETWORK"))
const l2Network = minaNetworkId(required("L2_NETWORK"))
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
		if (url.pathname === "/v1/bridge/deposits") return Response.json(deposits)
		const match = /^\/v1\/bridge\/deposits\/(\d+)$/.exec(url.pathname)
		if (match) {
			const deposit = deposits.find((candidate) => candidate.nonce === Number(match[1]))
			return deposit ? Response.json(deposit) : new Response(null, { status: 404 })
		}
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

const signTransaction: Parameters<EthereumBridgeClient["finalizeDeposit"]>[1] = async (
	transaction
) => transaction.sign([privateKey])

for (const asset of assets) {
	await client.registerAssetRecord({
		record: asset,
		feePayer: { sender: recipient, fee: 100_000_000 },
		signTransaction
	})
	await retry(`registry index ${asset.registryIndex}`, () =>
		client.getZekoAsset(asset.ethereumTokenAddress)
	)
	console.log(`[live-sequencer-e2e] Registered asset ${asset.registryIndex}`)
}
await writeFile(harness.registrationCompletionMarker, "registered\n")
await waitForFile(harness.operationsReadyMarker)

const indexedTokenDeposits = bridgeAsset === "erc20" ? await client.listDeposits({ recipient }) : []
const tokenDepositByRegistryIndex = new Map(
	assets.map((asset) => {
		const deposit = [...indexedTokenDeposits]
			.reverse()
			.find(
				(candidate) =>
					candidate.assetId !== null &&
					getAddress(candidate.token) === getAddress(asset.ethereumTokenAddress)
			)
		if (!deposit) {
			throw new Error(`No indexed deposit found for registry asset ${asset.registryIndex}`)
		}
		ethereumTokenDepositSelection(deposit)
		return [asset.registryIndex, deposit] as const
	})
)

const preparations = await Promise.all(
	assets.length > 0
		? assets.map((asset) =>
				retry(`deposit preparation ${asset.registryIndex}`, async () => {
					const deposit = tokenDepositByRegistryIndex.get(asset.registryIndex)
					if (!deposit) throw new Error(`Missing deposit for registry asset ${asset.registryIndex}`)
					const preparation = await client.prepareTokenDepositFinalization(recipient, deposit)
					if (!preparation.available) {
						throw new Error(preparation.reason ?? "Deposit finalization is not available")
					}
					return preparation
				})
			)
		: [
				retry("native deposit preparation", async () => {
					const preparation = await client.prepareDepositFinalization(recipient)
					if (!preparation.available) {
						throw new Error(preparation.reason ?? "Deposit finalization is not available")
					}
					return preparation
				})
			]
)
for (const preparation of preparations) {
	if (!preparation.available) {
		throw new Error(preparation.reason ?? "Deposit finalization is not available")
	}
}

const tokenDeployments: Awaited<ReturnType<typeof deployEthereumTokenMirror>>[] = []
const tokenBalances: Array<{ token: Address; vault: string; recipient: string }> = []
const depositTransactionHashes: string[] = []
const withdrawalTransactionHashes: string[] = []

if (bridgeAsset === "erc20") {
	const verificationKeyData = harness.ethereumTokenBridgeVerificationKey
	const verificationKeyHash = harness.ethereumTokenBridgeVerificationKeyHash
	if (!verificationKeyData || !verificationKeyHash) {
		throw new Error("Live sequencer did not publish its universal ERC20 bridge verification key")
	}
	const bridgeVerificationKey = new VerificationKey({
		data: verificationKeyData,
		hash: Field(verificationKeyHash)
	})
	const tokenVaultKey = PrivateKey.fromBase58(required("ERC20_SHARED_VAULT_PRIVATE_KEY"))
	Mina.setActiveInstance(
		Mina.Network({
			mina: harness.sequencerGraphqlUrl,
			archive: harness.sequencerGraphqlUrl,
			networkId: l2Network
		})
	)

	for (const asset of assets) {
		const index = asset.registryIndex
		const indexedDeposit = tokenDepositByRegistryIndex.get(index)
		if (!indexedDeposit) throw new Error(`Missing deposit for registry asset ${index}`)
		const { encodingVersion } = ethereumTokenDepositSelection(indexedDeposit)
		const { config } = await client.getZekoAsset(asset.ethereumTokenAddress)
		const tokenOwnerKey = PrivateKey.fromBase58(required(`ERC20_TOKEN_${index}_OWNER_PRIVATE_KEY`))
		const adminContractKey = PrivateKey.fromBase58(
			required(`ERC20_TOKEN_${index}_ADMIN_CONTRACT_PRIVATE_KEY`)
		)
		const adminAuthorityKey = PrivateKey.fromBase58(
			required(`ERC20_TOKEN_${index}_ADMIN_AUTHORITY_PRIVATE_KEY`)
		)
		const finalAdminContractKey = PrivateKey.random()
		if (!tokenOwnerKey.toPublicKey().equals(config.tokenOwnerL2).toBoolean()) {
			throw new Error(`Token ${index} owner key does not match its registry record`)
		}
		if (!tokenVaultKey.toPublicKey().equals(config.holderAccountL2).toBoolean()) {
			throw new Error("Shared vault key does not match universal registry configuration")
		}
		const inventory = UInt64.from(asset.inventoryCap)
		const signDeployment = async (transaction: Parameters<typeof signTransaction>[0]) =>
			transaction.sign([privateKey, tokenOwnerKey, adminContractKey])
		const signProvisioning = async (transaction: Parameters<typeof signTransaction>[0]) =>
			transaction.sign([
				privateKey,
				tokenVaultKey,
				adminContractKey,
				adminAuthorityKey,
				finalAdminContractKey
			])
		const deployment = await deployEthereumTokenMirror({
			config,
			registration: {
				registered: true,
				allowed: true,
				assetId: asset.assetId,
				ethereumTokenAddress: asset.ethereumTokenAddress,
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
			finalAdminContractL2: finalAdminContractKey.toPublicKey(),
			symbol: `ZP2${index}`,
			sourceUri: `https://zeko.invalid/local-erc20/${index}`,
			signDeployment,
			signProvisioning,
			waitForInclusion: async () => {}
		})
		tokenDeployments.push(deployment)
		depositTransactionHashes.push(
			await client.finalizeTokenDeposit({
				feePayer: { sender: recipient, fee: 100_000_000 },
				recipient,
				token: asset.ethereumTokenAddress,
				encodingVersion,
				signTransaction
			})
		)
		withdrawalTransactionHashes.push(
			await client.requestTokenWithdrawal({
				feePayer: { sender: recipient, fee: 100_000_000 },
				sender: recipient,
				recipient: withdrawalRecipient,
				token: asset.ethereumTokenAddress,
				amount: UInt64.from(withdrawalAmount),
				signTransaction
			})
		)
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
				`Unexpected ERC20[${index}] balances: recipient=${recipientBalance}, vault=${vaultBalance}`
			)
		}
		tokenBalances.push({
			token: asset.ethereumTokenAddress,
			vault: vaultBalance.toString(),
			recipient: recipientBalance.toString()
		})
	}
} else {
	depositTransactionHashes.push(await client.finalizeDeposit(recipient, signTransaction))
	withdrawalTransactionHashes.push(
		await client.requestWithdrawal({
			feePayer: { sender: recipient, fee: 100_000_000 },
			sender: recipient,
			recipient: withdrawalRecipient,
			amount: UInt64.from(withdrawalAmount),
			signTransaction
		})
	)
}

if (assets.length === 2) {
	const [first, second] = assets
	if (
		!first ||
		!second ||
		first.tokenOwnerL2 === second.tokenOwnerL2 ||
		first.tokenIdL2 === second.tokenIdL2 ||
		first.assetId === second.assetId
	) {
		throw new Error("Cross-asset identity separation failed")
	}
}

const output = {
	status: "passed",
	preparations,
	depositTransactionHashes,
	withdrawalTransactionHashes,
	recipient: recipient.toBase58(),
	withdrawalRecipient,
	withdrawalAmount,
	bridgeAsset,
	tokenDeployments,
	tokenBalances,
	registryRecords: assets
}
const outputJson = JSON.stringify(output, (_, value) =>
	typeof value === "bigint" ? value.toString() : value
)
await writeFile(harness.completionMarker, `${outputJson}\n`)
console.log(outputJson)
