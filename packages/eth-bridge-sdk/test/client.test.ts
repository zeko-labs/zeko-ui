import {
	buildEthereumAssetRegistryTree,
	type DepositWithState,
	ETHEREUM_ASSET_REGISTRY_DEPTH,
	ethereumAssetRegistryFieldHex
} from "@zeko-labs/bridge-sdk"
import { Field, PrivateKey, TokenId } from "o1js"
import {
	decodeFunctionData,
	type EIP1193Provider,
	encodeAbiParameters,
	encodeEventTopics,
	encodeFunctionResult,
	getAddress,
	type Hex,
	parseAbiParameters,
	toHex
} from "viem"
import { afterEach, describe, expect, it, vi } from "vitest"

const { createBridgeRuntimeMock } = vi.hoisted(() => ({
	createBridgeRuntimeMock: vi.fn()
}))

vi.mock("@zeko-labs/bridge-sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@zeko-labs/bridge-sdk")>()
	class MockBridge {
		private readonly runtime: {
			ethereumAssets: { registryCount: number } | null
			ethereumToken: null
		}

		public constructor(runtime: unknown) {
			this.runtime = runtime as typeof this.runtime
		}

		public get ethereumAssets() {
			return this.runtime.ethereumAssets
		}

		public get ethereumToken() {
			return this.runtime.ethereumToken
		}

		public async fetchEthereumAsset() {
			return {
				membership: {
					record: {
						registryIndex: (this.runtime.ethereumAssets?.registryCount ?? 0) - 1
					}
				}
			}
		}
	}
	return {
		...actual,
		Bridge: MockBridge,
		buildEthereumAssetRegistryTree: vi.fn(actual.buildEthereumAssetRegistryTree),
		createBridgeRuntime: createBridgeRuntimeMock
	}
})

import { ethereumZekoBridgeAbi } from "../src/abi"
import {
	buildEthereumBridgeDeposit,
	EthereumBridgeClient,
	ethereumTokenDepositSelection,
	mergeDepositActivity
} from "../src/client"
import { ethereumAddressToZekoPublicKey, packZekoAddress, unpackZekoAddress } from "../src/codecs"
import type { DepositStatus, TokenWithdrawalProof } from "../src/gateway"
import {
	type EthereumAssetRecord,
	type EthereumAssetRegistrySnapshot,
	ethereumAssetRecordBatchMembership
} from "../src/registry"

const gatewayDeposit = (outerActionSequence: number | null): DepositStatus => ({
	nonce: 4,
	token: "0x0000000000000000000000000000000000000000",
	assetId: null,
	sender: "0x0000000000000000000000000000000000000001",
	zekoRecipient: "0x01",
	ethereumAmount: "1000000000000000000",
	zekoAmount: "1000000000",
	timeout: 100,
	ethereumTransactionHash: `0x${"12".repeat(32)}`,
	ethereumFinalized: true,
	encodingVersion: null,
	bridgeJobId: "job",
	bridgeJobStatus: "confirmed",
	outerActionSequence,
	outerActionStateAfter: "state",
	synchronizedSettlementSequence: 2,
	status: "synchronized",
	nextAction: "finalizeDepositOnZeko"
})

const account = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
const bridgeAddress = "0x00000000000000000000000000000000000000b1"

const gatewayConfig = {
	schemaVersion: 1,
	chainId: 31337,
	bridgeAddress,
	settlementAddress: "0x00000000000000000000000000000000000000b2",
	ethereumDecimals: 18,
	zekoNativeDecimals: 9,
	ethereumConfirmations: 1,
	withdrawalDelaySlots: 5,
	currentVirtualSlot: 20
}

const registryWord = (value: bigint): Hex => toHex(value, { size: 32 })

const registryRecord = (registryIndex: number, suffix: number): EthereumAssetRecord => {
	const tokenOwnerL2 = registryWord((1n << 255n) | BigInt(2_000 + suffix))
	return {
		schemaVersion: 1,
		registryIndex,
		assetId: registryWord(BigInt(1_000 + suffix)),
		ethereumTokenAddress: getAddress(`0x${suffix.toString(16).padStart(40, "0")}` as `0x${string}`),
		tokenOwnerL2,
		tokenIdL2: registryWord(TokenId.derive(unpackZekoAddress(tokenOwnerL2)).toBigInt()),
		decimals: 9,
		inventoryCap: 1_000_000n,
		mftStandardVkId: registryWord(4_000n),
		vaultPublicKey: registryWord((1n << 255n) | 5_000n),
		universalBridgeVkId: registryWord(6_000n)
	}
}

const registrySnapshot = (
	records: readonly EthereumAssetRecord[]
): EthereumAssetRegistrySnapshot => {
	const tree = buildEthereumAssetRegistryTree(records)
	return {
		schemaVersion: 1,
		root: ethereumAssetRegistryFieldHex(tree.root),
		count: records.length,
		depth: ETHEREUM_ASSET_REGISTRY_DEPTH,
		records: records.map((record) => ({
			record,
			path: tree.path(record.registryIndex).map(ethereumAssetRegistryFieldHex)
		}))
	}
}

const runtimeWithRegistry = (snapshot: EthereumAssetRegistrySnapshot) => {
	const first = snapshot.records[0]?.record
	if (!first) throw new Error("Test runtime requires an asset record")
	return {
		ethereumAssets: {
			registrySchemaVersion: snapshot.schemaVersion,
			registryRoot: Field(BigInt(snapshot.root)),
			registryCount: snapshot.count,
			approvedMftStandardVkId: Field(BigInt(first.mftStandardVkId)),
			vaultPublicKey: unpackZekoAddress(first.vaultPublicKey),
			universalBridgeVkId: Field(BigInt(first.universalBridgeVkId))
		},
		ethereumToken: null
	}
}

afterEach(() => {
	createBridgeRuntimeMock.mockReset()
})

const recordingProvider = () => {
	const transactions: Record<string, Hex>[] = []
	const transactionHash = `0x${"99".repeat(32)}`
	const provider: EIP1193Provider = {
		request: async ({ method, params }) => {
			if (method === "eth_chainId") return "0x7a69"
			if (method === "eth_accounts") return [account]
			if (method === "eth_sendTransaction") {
				transactions.push((params as [Record<string, Hex>])[0])
				return transactionHash
			}
			if (method === "eth_getTransactionReceipt")
				return {
					blockHash: `0x${"77".repeat(32)}`,
					blockNumber: "0x1",
					contractAddress: null,
					cumulativeGasUsed: "0x5208",
					effectiveGasPrice: "0x1",
					from: account,
					gasUsed: "0x5208",
					logs: [],
					logsBloom: `0x${"00".repeat(256)}`,
					status: "0x1",
					to: bridgeAddress,
					transactionHash,
					transactionIndex: "0x0",
					type: "0x2"
				}
			if (method === "eth_blockNumber") return "0x1"
			throw new Error(`Unexpected RPC method ${method}`)
		}
	}
	return { provider, transactions }
}

describe("deposit activity", () => {
	it("matches the gateway's one-based sequence to the canonical action index", () => {
		const state = {
			index: 3,
			accepted: true,
			bridgeVersion: "v2",
			cancellable: false,
			cancelled: false,
			confirmed: true,
			finalised: true,
			synced: true
		} as DepositWithState
		expect(mergeDepositActivity([gatewayDeposit(4)], [state])).toMatchObject([
			{
				actionIndex: 3,
				zekoFinalized: true,
				status: "finalized",
				nextAction: "none"
			}
		])
	})

	it("does not guess an L2 state before the outer action exists", () => {
		expect(mergeDepositActivity([gatewayDeposit(null)], [])).toMatchObject([
			{
				actionIndex: null,
				zekoFinalized: false,
				zekoState: null,
				status: "synchronized"
			}
		])
	})
})

describe("versioned gateway deposits", () => {
	it("requires the indexed encoding version when selecting a token deposit", () => {
		const token = "0x00000000000000000000000000000000000000a1"
		expect(ethereumTokenDepositSelection({ token, encodingVersion: 1 })).toMatchObject({
			encodingVersion: 1,
			asset: { ethereumTokenAddress: getAddress(token) }
		})
		expect(() => ethereumTokenDepositSelection({ token, encodingVersion: null })).toThrow(
			/encoding version/i
		)
	})

	it("keeps a registered historical V1 deposit on the asset-only encoding", async () => {
		const deposit = {
			...gatewayDeposit(4),
			token: "0x00000000000000000000000000000000000000a1",
			assetId: `0x${"44".repeat(32)}` as Hex,
			encodingVersion: 1 as const
		}
		const resolveV2Asset = vi.fn()

		const result = await buildEthereumBridgeDeposit({
			deposit,
			holderAccountL1: PrivateKey.random().toPublicKey(),
			resolveV2Asset
		})

		expect(result.assetId).toBe(deposit.assetId)
		expect(result.encodingVersion).toBeUndefined()
		expect(resolveV2Asset).not.toHaveBeenCalled()
	})

	it("resolves registry identity only for an explicitly V2 deposit", async () => {
		const deposit = {
			...gatewayDeposit(5),
			token: "0x00000000000000000000000000000000000000a1",
			assetId: `0x${"44".repeat(32)}` as Hex,
			encodingVersion: 2 as const
		}
		const recordCommitment = Field(99)
		const resolveV2Asset = vi.fn(async () => ({ registryIndex: 7, recordCommitment }))

		await expect(
			buildEthereumBridgeDeposit({
				deposit,
				holderAccountL1: PrivateKey.random().toPublicKey(),
				resolveV2Asset
			})
		).resolves.toMatchObject({
			assetId: deposit.assetId,
			encodingVersion: 2,
			registryIndex: 7,
			recordCommitment
		})
		expect(resolveV2Asset).toHaveBeenCalledWith(deposit.assetId)
	})
})

describe("authenticated registry refresh", () => {
	it("atomically replaces the local registry and Bridge runtime checkpoint", async () => {
		const first = registryRecord(0, 1)
		const second = registryRecord(1, 2)
		const initial = registrySnapshot([first])
		const appended = registrySnapshot([first, second])
		createBridgeRuntimeMock
			.mockResolvedValueOnce(runtimeWithRegistry(initial))
			.mockResolvedValueOnce(runtimeWithRegistry(appended))
			.mockResolvedValueOnce(runtimeWithRegistry(initial))
			.mockResolvedValueOnce(runtimeWithRegistry(appended))
		const { provider } = recordingProvider()
		const client = await EthereumBridgeClient.init({
			gatewayUrl: "https://gateway.test",
			provider,
			fetch: async () => Response.json(gatewayConfig),
			zeko: {
				zekoUrl: "https://zeko.test/graphql",
				zekoArchiveUrl: "https://zeko-archive.test/graphql",
				l1Network: "devnet",
				l2Network: "devnet",
				actionsApi: "https://actions.test/graphql"
			},
			assets: { snapshot: initial }
		})

		expect(
			(await client.getZekoAsset(first.ethereumTokenAddress)).membership.record.registryIndex
		).toBe(0)

		vi.mocked(buildEthereumAssetRegistryTree).mockClear()
		await expect(client.refreshAssetRegistry(appended)).resolves.toMatchObject({
			root: appended.root,
			count: 2
		})
		expect(buildEthereumAssetRegistryTree).toHaveBeenCalledTimes(1)
		expect(
			(await client.getZekoAsset(second.ethereumTokenAddress)).membership.record.registryIndex
		).toBe(1)

		await expect(client.refreshAssetRegistry(appended)).rejects.toThrow(
			/authenticated (?:Zeko )?runtime root/i
		)
		expect(client.assetRegistry).toMatchObject({ root: appended.root, count: 2 })
		expect(
			(await client.getZekoAsset(second.ethereumTokenAddress)).membership.record.registryIndex
		).toBe(1)
		await expect(client.refreshAssetRegistry(appended)).resolves.toMatchObject({
			root: appended.root,
			count: 2
		})
	}, 15_000)

	it("serializes overlapping refreshes before installing their checkpoints", async () => {
		const first = registryRecord(0, 1)
		const second = registryRecord(1, 2)
		const third = registryRecord(2, 3)
		const initial = registrySnapshot([first])
		const intermediate = registrySnapshot([first, second])
		const latest = registrySnapshot([first, second, third])
		let resolveIntermediate!: (runtime: ReturnType<typeof runtimeWithRegistry>) => void
		const pendingIntermediate = new Promise<ReturnType<typeof runtimeWithRegistry>>((resolve) => {
			resolveIntermediate = resolve
		})
		createBridgeRuntimeMock
			.mockResolvedValueOnce(runtimeWithRegistry(initial))
			.mockReturnValueOnce(pendingIntermediate)
			.mockResolvedValueOnce(runtimeWithRegistry(latest))
		const { provider } = recordingProvider()
		const client = await EthereumBridgeClient.init({
			gatewayUrl: "https://gateway.test",
			provider,
			fetch: async () => Response.json(gatewayConfig),
			zeko: {
				zekoUrl: "https://zeko.test/graphql",
				zekoArchiveUrl: "https://zeko-archive.test/graphql",
				l1Network: "devnet",
				l2Network: "devnet",
				actionsApi: "https://actions.test/graphql"
			},
			assets: { snapshot: initial }
		})

		const intermediateRefresh = client.refreshAssetRegistry(intermediate)
		const latestRefresh = client.refreshAssetRegistry(latest)
		await Promise.resolve()
		await Promise.resolve()
		expect(createBridgeRuntimeMock).toHaveBeenCalledTimes(2)

		resolveIntermediate(runtimeWithRegistry(intermediate))
		await expect(Promise.all([intermediateRefresh, latestRefresh])).resolves.toHaveLength(2)
		expect(client.assetRegistry).toMatchObject({ root: latest.root, count: 3 })
		expect(
			(await client.getZekoAsset(third.ethereumTokenAddress)).membership.record.registryIndex
		).toBe(2)
	})
})

describe("ERC20 bridge transactions", () => {
	it("rejects circuit-invalid proposals before wallet submission and preserves valid proposals", async () => {
		const existing = registryRecord(0, 1)
		const candidate = registryRecord(1, 2)
		const initial = registrySnapshot([existing])
		createBridgeRuntimeMock.mockResolvedValueOnce(runtimeWithRegistry(initial))
		const recorded = recordingProvider()
		const provider: EIP1193Provider = {
			request: async (request) => {
				if (request.method === "eth_call") {
					const call = (request.params as [{ data: Hex }])[0]
					const decoded = decodeFunctionData({ abi: ethereumZekoBridgeAbi, data: call.data })
					if (decoded.functionName === "proposedAssetCount") {
						return encodeFunctionResult({
							abi: ethereumZekoBridgeAbi,
							functionName: "proposedAssetCount",
							result: 1
						})
					}
				}
				return recorded.provider.request(request)
			}
		}
		const client = await EthereumBridgeClient.init({
			gatewayUrl: "https://gateway.test",
			provider,
			fetch: async () => Response.json(gatewayConfig),
			zeko: {
				zekoUrl: "https://zeko.test/graphql",
				zekoArchiveUrl: "https://zeko-archive.test/graphql",
				l1Network: "devnet",
				l2Network: "devnet",
				actionsApi: "https://actions.test/graphql"
			},
			assets: { snapshot: initial }
		})

		const invalidProposals: [string, EthereumAssetRecord][] = [
			[
				"canonical token owner",
				{
					...candidate,
					tokenOwnerL2: registryWord((1n << 255n) | Field.ORDER),
					tokenIdL2: registryWord(
						TokenId.derive(unpackZekoAddress(registryWord((1n << 255n) | Field.ORDER))).toBigInt()
					)
				}
			],
			["derived token ID", { ...candidate, tokenIdL2: registryWord(999_999n) }],
			["MFT standard VK", { ...candidate, mftStandardVkId: registryWord(999_999n) }],
			["shared vault", { ...candidate, vaultPublicKey: registryWord(999_999n) }],
			["universal bridge VK", { ...candidate, universalBridgeVkId: registryWord(999_999n) }]
		]
		for (const [label, invalid] of invalidProposals) {
			await expect(client.proposeAsset(invalid), label).rejects.toThrow()
		}
		expect(recorded.transactions).toHaveLength(0)

		await expect(client.proposeAsset(candidate)).resolves.toBe(`0x${"99".repeat(32)}`)
		expect(recorded.transactions).toHaveLength(1)
		const proposed = decodeFunctionData({
			abi: ethereumZekoBridgeAbi,
			data: recorded.transactions[0]?.data ?? "0x"
		})
		expect(proposed.functionName).toBe("proposeAsset")

		await expect(client.cancelLastPendingAsset(candidate.ethereumTokenAddress)).resolves.toBe(
			`0x${"99".repeat(32)}`
		)
		expect(recorded.transactions).toHaveLength(2)
		const cancelled = decodeFunctionData({
			abi: ethereumZekoBridgeAbi,
			data: recorded.transactions[1]?.data ?? "0x"
		})
		expect(cancelled).toMatchObject({
			functionName: "cancelLastPendingAsset",
			args: [candidate.ethereumTokenAddress]
		})
	})

	it("reads the immutable Solidity registration used to provision the L2 token", async () => {
		const token = "0x00000000000000000000000000000000000000a1"
		const owner = PrivateKey.random().toPublicKey()
		const tokenId = TokenId.derive(owner)
		const assetId = `0x${"44".repeat(32)}` as Hex
		const depositCap = 1_000_000n
		const provider: EIP1193Provider = {
			request: async ({ method, params }) => {
				if (method === "eth_chainId") return "0x7a69"
				if (method === "eth_accounts") return [account]
				if (method === "eth_call") {
					const call = (params as [{ data: Hex }])[0]
					const decoded = decodeFunctionData({ abi: ethereumZekoBridgeAbi, data: call.data })
					switch (decoded.functionName) {
						case "canonicalTokenRegistered":
							return encodeFunctionResult({
								abi: ethereumZekoBridgeAbi,
								functionName: decoded.functionName,
								result: true
							})
						case "assetIdByToken":
							return encodeFunctionResult({
								abi: ethereumZekoBridgeAbi,
								functionName: decoded.functionName,
								result: assetId
							})
						case "zekoTokenOwnerByToken":
							return encodeFunctionResult({
								abi: ethereumZekoBridgeAbi,
								functionName: decoded.functionName,
								result: packZekoAddress(owner)
							})
						case "zekoTokenIdByToken":
							return encodeFunctionResult({
								abi: ethereumZekoBridgeAbi,
								functionName: decoded.functionName,
								result: toHex(tokenId.toBigInt(), { size: 32 })
							})
						case "depositCapByToken":
							return encodeFunctionResult({
								abi: ethereumZekoBridgeAbi,
								functionName: decoded.functionName,
								result: depositCap
							})
						case "allowedToken":
							return encodeFunctionResult({
								abi: ethereumZekoBridgeAbi,
								functionName: decoded.functionName,
								result: [9, 9, true]
							})
						default:
							throw new Error(`Unexpected contract read ${decoded.functionName}`)
					}
				}
				throw new Error(`Unexpected RPC method ${method}`)
			}
		}
		const fetcher: typeof fetch = async () => Response.json(gatewayConfig)
		const client = await EthereumBridgeClient.init({
			gatewayUrl: "https://gateway.test",
			provider,
			fetch: fetcher
		})

		const registration = await client.getTokenRegistration(token)

		expect(registration).toMatchObject({
			registered: true,
			allowed: true,
			assetId,
			ethereumTokenAddress: getAddress(token),
			zekoDecimals: 9,
			ethereumDecimals: 9
		})
		expect(registration.zekoTokenOwnerL2.equals(owner).toBoolean()).toBe(true)
		expect(registration.zekoTokenIdL2.equals(Field(tokenId)).toBoolean()).toBe(true)
		expect(registration.depositCap.toBigInt()).toBe(depositCap)
	})

	it("calls canonical submitDeposit and returns the indexed gateway deposit", async () => {
		const transactions: Record<string, Hex>[] = []
		const nonce = 7n
		const depositLeaf = `0x${"10".repeat(32)}` as Hex
		const newDepositState = `0x${"20".repeat(32)}` as Hex
		const transactionHash = `0x${"99".repeat(32)}` as Hex
		const token = "0x00000000000000000000000000000000000000a1"
		const recipient = ethereumAddressToZekoPublicKey(account)
		const packedRecipient = BigInt(packZekoAddress(recipient))
		const amount = 2_000_000n
		const topics = encodeEventTopics({
			abi: ethereumZekoBridgeAbi,
			eventName: "BridgeDeposit",
			args: { nonce, depositLeaf, newDepositState }
		})
		const data = encodeAbiParameters(
			parseAbiParameters("bytes32,address,address,uint256,uint256,uint256,uint64"),
			[`0x${"00".repeat(32)}`, token, account, packedRecipient, amount, amount, 4_294_967_295n]
		)
		const provider: EIP1193Provider = {
			request: async ({ method, params }) => {
				if (method === "eth_chainId") return "0x7a69"
				if (method === "eth_accounts") return [account]
				if (method === "eth_sendTransaction") {
					transactions.push((params as [Record<string, Hex>])[0])
					return transactionHash
				}
				if (method === "eth_getTransactionReceipt") {
					return {
						blockHash: `0x${"77".repeat(32)}`,
						blockNumber: "0x1",
						contractAddress: null,
						cumulativeGasUsed: "0x5208",
						effectiveGasPrice: "0x1",
						from: account,
						gasUsed: "0x5208",
						logs: [
							{
								address: bridgeAddress,
								blockHash: `0x${"77".repeat(32)}`,
								blockNumber: "0x1",
								data,
								logIndex: "0x0",
								removed: false,
								topics,
								transactionHash,
								transactionIndex: "0x0"
							}
						],
						logsBloom: `0x${"00".repeat(256)}`,
						status: "0x1",
						to: bridgeAddress,
						transactionHash,
						transactionIndex: "0x0",
						type: "0x2"
					}
				}
				if (method === "eth_blockNumber") return "0x1"
				throw new Error(`Unexpected RPC method ${method}`)
			}
		}
		const indexedDeposit: DepositStatus = {
			...gatewayDeposit(null),
			nonce: Number(nonce),
			token,
			assetId: `0x${"44".repeat(32)}`,
			ethereumAmount: amount.toString(),
			zekoAmount: amount.toString()
		}
		const fetcher: typeof fetch = async (input) =>
			Response.json(String(input).endsWith(`/deposits/${nonce}`) ? indexedDeposit : gatewayConfig)
		const client = await EthereumBridgeClient.init({
			gatewayUrl: "https://gateway.test",
			provider,
			fetch: fetcher
		})

		await expect(client.depositToken({ token, recipient, amount })).resolves.toMatchObject({
			hash: transactionHash,
			nonce: Number(nonce),
			deposit: { ...indexedDeposit, token: getAddress(token) }
		})
		expect(decodeFunctionData({ abi: ethereumZekoBridgeAbi, data: transactions[0].data })).toEqual({
			functionName: "submitDeposit",
			args: ["0x00000000000000000000000000000000000000A1", amount, packedRecipient]
		})
	})

	it("forwards the proof-bound token withdrawal arguments to Solidity", async () => {
		const { provider, transactions } = recordingProvider()
		const fetcher: typeof fetch = async () => Response.json(gatewayConfig)
		const client = await EthereumBridgeClient.init({
			gatewayUrl: "https://gateway.test",
			provider,
			fetch: fetcher
		})
		const withdrawal: TokenWithdrawalProof = {
			settlementSequence: 4,
			offset: 2,
			globalActionIndex: 12,
			token: "0x00000000000000000000000000000000000000a1",
			assetId: `0x${"44".repeat(32)}`,
			recipient: account,
			amount: "2000000",
			actionFieldsHash: `0x${"11".repeat(32)}`,
			siblings: Array.from({ length: 16 }, () => `0x${"22".repeat(32)}` as Hex),
			innerActionRoot: `0x${"33".repeat(32)}`,
			commitSlotUpper: 10,
			claimableSlot: 15,
			currentVirtualSlot: 20,
			recipientCursor: 12,
			status: "claimable",
			nextAction: "claimERC20Withdrawal"
		}

		await client.claimTokenWithdrawal(withdrawal)

		expect(transactions).toHaveLength(1)
		expect(decodeFunctionData({ abi: ethereumZekoBridgeAbi, data: transactions[0].data })).toEqual({
			functionName: "claimERC20Withdrawal",
			args: [
				4n,
				2,
				"0x00000000000000000000000000000000000000A1",
				getAddress(account),
				2_000_000n,
				withdrawal.actionFieldsHash,
				withdrawal.siblings
			]
		})
	})

	it("binds the Mina record commitment into batch activation", async () => {
		const recorded = recordingProvider()
		const token = "0x00000000000000000000000000000000000000a1"
		const word = (value: bigint): Hex => toHex(value, { size: 32 })
		const record: EthereumAssetRecord = {
			schemaVersion: 1,
			registryIndex: 0,
			assetId: `0x${"44".repeat(32)}`,
			ethereumTokenAddress: token,
			tokenOwnerL2: word((1n << 255n) | 111n),
			tokenIdL2: word(222n),
			decimals: 9,
			inventoryCap: 1_000_000n,
			mftStandardVkId: word(333n),
			vaultPublicKey: word(444n),
			universalBridgeVkId: word(555n)
		}
		const provider: EIP1193Provider = {
			request: async (request) => {
				if (request.method === "eth_call") {
					const call = (request.params as [{ data: Hex }])[0]
					const decoded = decodeFunctionData({ abi: ethereumZekoBridgeAbi, data: call.data })
					if (decoded.functionName === "assetRecord") {
						return encodeFunctionResult({
							abi: ethereumZekoBridgeAbi,
							functionName: "assetRecord",
							result: {
								schemaVersion: record.schemaVersion,
								registryIndex: record.registryIndex,
								assetId: record.assetId,
								ethereumToken: record.ethereumTokenAddress,
								tokenOwnerL2: record.tokenOwnerL2,
								tokenIdL2: record.tokenIdL2,
								decimals: record.decimals,
								inventoryCap: record.inventoryCap,
								mftStandardVkId: record.mftStandardVkId,
								vaultPublicKey: record.vaultPublicKey,
								universalBridgeVkId: record.universalBridgeVkId
							}
						})
					}
					if (decoded.functionName === "assetStatusByToken") {
						return encodeFunctionResult({
							abi: ethereumZekoBridgeAbi,
							functionName: "assetStatusByToken",
							result: 1
						})
					}
				}
				return recorded.provider.request(request)
			}
		}
		const client = await EthereumBridgeClient.init({
			gatewayUrl: "https://gateway.test",
			provider,
			fetch: async () => Response.json(gatewayConfig)
		})
		const membership = ethereumAssetRecordBatchMembership([record], record)

		await client.activateAssetFromBatch({
			token,
			settlementSequence: 4n,
			batchRecords: [record]
		})

		expect(
			decodeFunctionData({ abi: ethereumZekoBridgeAbi, data: recorded.transactions[0].data })
		).toEqual({
			functionName: "activateAssetFromBatch",
			args: [getAddress(token), 4n, membership.recordCommitment, membership.proof]
		})
	})
})
