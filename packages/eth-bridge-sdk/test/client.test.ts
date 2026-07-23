import type {
	Bridge,
	DepositWithState,
	RetryableTransactionOptions,
	SignTransaction
} from "@zeko-labs/bridge-sdk"
import type { PublicKey } from "o1js"
import type { Address, EIP1193Provider } from "viem"
import { describe, expect, it, vi } from "vitest"
import { EthereumBridgeClient, mergeDepositActivity } from "../src/client"
import type { BridgeConfig, DepositStatus, GatewayClient } from "../src/gateway"

const gatewayDeposit = (outerActionSequence: number | null): DepositStatus => ({
	nonce: 4,
	token: "0x0000000000000000000000000000000000000000",
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

describe("Ethereum deposit finalization routing", () => {
	it("uses the Ethereum-only bridge methods", async () => {
		const canFinalizeEthereumDeposit = vi.fn().mockResolvedValue({
			available: true,
			reason: null,
			index: 4
		})
		const finalizeEthereumDeposit = vi.fn().mockResolvedValue("5Jfinalized")
		const bridge = {
			canFinalizeEthereumDeposit,
			finalizeEthereumDeposit
		} as unknown as Bridge
		const UnsafeEthereumBridgeClient = EthereumBridgeClient as unknown as new (input: {
			account: Address
			bridge: Bridge
			config: BridgeConfig
			gateway: GatewayClient
			provider: EIP1193Provider
		}) => EthereumBridgeClient
		const client = new UnsafeEthereumBridgeClient({
			account: "0x0000000000000000000000000000000000000001",
			bridge,
			config: {
				schemaVersion: 1,
				chainId: 1,
				bridgeAddress: "0x0000000000000000000000000000000000000002",
				settlementAddress: "0x0000000000000000000000000000000000000003",
				ethereumDecimals: 18,
				zekoNativeDecimals: 9,
				ethereumConfirmations: 1,
				withdrawalDelaySlots: 1,
				currentVirtualSlot: 1
			},
			gateway: {} as GatewayClient,
			provider: { request: vi.fn() } as unknown as EIP1193Provider
		})
		const recipient = {} as PublicKey
		const signTransaction = vi.fn() as unknown as SignTransaction
		const options: RetryableTransactionOptions = { attempts: 2, feeNanomina: 3n }

		await expect(client.prepareDepositFinalization(recipient)).resolves.toEqual({
			available: true,
			reason: null,
			index: 4
		})
		await expect(client.finalizeDeposit(recipient, signTransaction, options)).resolves.toBe(
			"5Jfinalized"
		)
		expect(canFinalizeEthereumDeposit).toHaveBeenCalledWith(recipient)
		expect(finalizeEthereumDeposit).toHaveBeenCalledWith(recipient, signTransaction, options)
	})
})
