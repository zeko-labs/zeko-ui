import type { DepositWithState } from "@zeko-labs/bridge-sdk"
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
import { describe, expect, it } from "vitest"
import { ethereumZekoBridgeAbi } from "../src/abi"
import { EthereumBridgeClient, mergeDepositActivity } from "../src/client"
import { ethereumAddressToZekoPublicKey, packZekoAddress } from "../src/codecs"
import type { DepositStatus, TokenWithdrawalProof } from "../src/gateway"

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

describe("ERC20 bridge transactions", () => {
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
})
