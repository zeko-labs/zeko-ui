import {
	Bridge,
	type Config,
	createBridgeRuntime,
	type DepositWithState,
	ethereumDepositAux,
	type RetryableTransactionOptions,
	type SignTransaction
} from "@zeko-labs/bridge-sdk"
import { type Mina, type PublicKey, UInt32, UInt64 } from "o1js"
import {
	type Address,
	createPublicClient,
	createWalletClient,
	custom,
	decodeEventLog,
	type EIP1193Provider,
	getAddress,
	type Hash,
	type Hex
} from "viem"
import { ethereumZekoBridgeAbi } from "./abi"
import {
	ethereumAddressToZekoPublicKey,
	packZekoAddress,
	unpackZekoAddress,
	weiToZekoNativeUnits
} from "./codecs"
import {
	type BridgeConfig,
	type DepositStatus,
	GatewayClient,
	type WithdrawalProof,
	type WithdrawalRequest
} from "./gateway"

export type EthereumBridgeClientConfig = {
	gatewayUrl: string
	provider: EIP1193Provider
	account?: Address
	expectedChainId?: number
	fetch?: typeof globalThis.fetch
	zeko?: Omit<Config, "l1Url" | "l1ArchiveUrl"> & {
		v2DepositsStartIndex?: number
		v2WithdrawalsStartIndex?: number
	}
}

export type NativeDepositResult = {
	hash: Hash
	nonce: number
	deposit: DepositStatus
}

export type DepositActivity = DepositStatus & {
	actionIndex: number | null
	zekoFinalized: boolean
	zekoState: Pick<
		DepositWithState,
		| "accepted"
		| "bridgeVersion"
		| "cancellable"
		| "cancelled"
		| "confirmed"
		| "finalised"
		| "synced"
	> | null
}

export const mergeDepositActivity = (
	deposits: DepositStatus[],
	states: DepositWithState[]
): DepositActivity[] => {
	const byIndex = new Map(states.map((deposit) => [deposit.index, deposit]))
	return deposits.map((deposit) => {
		const actionIndex =
			deposit.outerActionSequence === null ? null : deposit.outerActionSequence - 1
		const zekoState = actionIndex === null ? undefined : byIndex.get(actionIndex)
		return {
			...deposit,
			actionIndex,
			zekoFinalized: zekoState?.finalised ?? false,
			zekoState: zekoState
				? {
						accepted: zekoState.accepted,
						bridgeVersion: zekoState.bridgeVersion,
						cancellable: zekoState.cancellable,
						cancelled: zekoState.cancelled,
						confirmed: zekoState.confirmed,
						finalised: zekoState.finalised,
						synced: zekoState.synced
					}
				: null,
			status: zekoState?.finalised ? "finalized" : deposit.status,
			nextAction: zekoState?.finalised ? "none" : deposit.nextAction
		}
	})
}

export class EthereumBridgeClient {
	readonly #account: Address
	readonly #bridge?: Bridge
	readonly #gateway: GatewayClient
	readonly #publicClient: ReturnType<typeof createPublicClient>
	readonly #walletClient: ReturnType<typeof createWalletClient>

	public readonly config: BridgeConfig

	private constructor(input: {
		account: Address
		bridge?: Bridge
		config: BridgeConfig
		gateway: GatewayClient
		provider: EIP1193Provider
	}) {
		this.#account = input.account
		this.#bridge = input.bridge
		this.config = input.config
		this.#gateway = input.gateway
		const transport = custom(input.provider)
		this.#publicClient = createPublicClient({ transport })
		this.#walletClient = createWalletClient({ transport })
	}

	public static async init(input: EthereumBridgeClientConfig): Promise<EthereumBridgeClient> {
		const gateway = new GatewayClient(input.gatewayUrl, input.fetch)
		const config = await gateway.config()
		if (input.expectedChainId !== undefined && input.expectedChainId !== config.chainId) {
			throw new Error(
				`Gateway chain ID ${config.chainId} does not match expected chain ID ${input.expectedChainId}`
			)
		}
		const walletClient = createWalletClient({ transport: custom(input.provider) })
		const walletChainId = await walletClient.getChainId()
		if (walletChainId !== config.chainId) {
			throw new Error(
				`Wallet chain ID ${walletChainId} does not match gateway chain ID ${config.chainId}`
			)
		}
		const account = input.account ?? (await walletClient.getAddresses())[0]
		if (!account) throw new Error("Ethereum wallet has no selected account")

		let bridge: Bridge | undefined
		if (input.zeko) {
			const runtime = await createBridgeRuntime({
				...input.zeko,
				l1Url: gateway.graphqlUrl,
				l1ArchiveUrl: gateway.graphqlUrl,
				v2DepositsStartIndex: input.zeko.v2DepositsStartIndex ?? 0,
				v2WithdrawalsStartIndex: input.zeko.v2WithdrawalsStartIndex ?? 0
			})
			const ethereumHolder = ethereumAddressToZekoPublicKey(config.bridgeAddress)
			const ethereumRuntime = {
				...runtime,
				bridge: {
					depositAux: ethereumDepositAux,
					fetchCurrentSlot: async () => UInt32.from((await gateway.config()).currentVirtualSlot),
					fetchUserDeposits: async (recipient: PublicKey) => {
						const deposits = await gateway.deposits({
							zekoRecipient: packZekoAddress(recipient)
						})
						return deposits.map((deposit) => ({
							recipient: unpackZekoAddress(deposit.zekoRecipient),
							amount: UInt64.from(deposit.zekoAmount),
							timeout: UInt32.from(deposit.timeout),
							holderAccountL1: ethereumHolder
						}))
					}
				}
			}
			bridge = new Bridge(ethereumRuntime)
		}

		return new EthereumBridgeClient({
			account: getAddress(account),
			bridge,
			config,
			gateway,
			provider: input.provider
		})
	}

	public get account(): Address {
		return this.#account
	}

	public async depositNative(input: {
		recipient: PublicKey
		valueWei: bigint
	}): Promise<NativeDepositResult> {
		weiToZekoNativeUnits(input.valueWei)
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account: this.#account,
			address: this.config.bridgeAddress,
			functionName: "depositETH",
			args: [BigInt(packZekoAddress(input.recipient))],
			chain: null,
			value: input.valueWei
		})
		const receipt = await this.#publicClient.waitForTransactionReceipt({ hash })
		if (receipt.status !== "success") throw new Error(`Ethereum deposit ${hash} reverted`)
		let nonce: number | undefined
		for (const log of receipt.logs) {
			if (getAddress(log.address) !== this.config.bridgeAddress) continue
			try {
				const event = decodeEventLog({
					abi: ethereumZekoBridgeAbi,
					data: log.data,
					topics: log.topics
				})
				if (event.eventName === "BridgeDeposit") nonce = Number(event.args.nonce)
			} catch {
				// Ignore unrelated bridge logs from the same receipt.
			}
		}
		if (nonce === undefined) throw new Error(`Ethereum deposit ${hash} emitted no BridgeDeposit`)
		return { hash, nonce, deposit: await this.waitForDeposit(nonce) }
	}

	public getDeposit(nonce: number): Promise<DepositStatus> {
		return this.#gateway.deposit(nonce)
	}

	public listDeposits(
		input: {
			recipient?: PublicKey
			after?: number
			limit?: number
		} = {}
	): Promise<DepositStatus[]> {
		return this.#gateway.deposits({
			zekoRecipient: input.recipient ? packZekoAddress(input.recipient) : undefined,
			after: input.after,
			limit: input.limit
		})
	}

	public async listDepositsWithStates(input: {
		recipient: PublicKey
		after?: number
		limit?: number
	}): Promise<DepositActivity[]> {
		const [deposits, state] = await Promise.all([
			this.listDeposits(input),
			this.requireZekoBridge().fetchDepositsWithStates(input.recipient)
		])
		return mergeDepositActivity(deposits, state.deposits)
	}

	public prepareDepositFinalization(recipient: PublicKey) {
		return this.requireZekoBridge().canFinalizeDeposit(recipient)
	}

	public finalizeDeposit(
		recipient: PublicKey,
		signTransaction: SignTransaction,
		options?: number | RetryableTransactionOptions
	): Promise<string> {
		return this.requireZekoBridge().finalizeDeposit(recipient, signTransaction, options)
	}

	public requestWithdrawal(input: {
		feePayer: Mina.FeePayerSpec
		sender: PublicKey
		recipient: Address
		amount: UInt64
		signTransaction: SignTransaction
	}): Promise<string> {
		return this.requireZekoBridge().submitWithdrawal(
			input.feePayer,
			{
				sender: input.sender,
				recipient: ethereumAddressToZekoPublicKey(input.recipient),
				amount: input.amount,
				route: "ethereum"
			},
			input.signTransaction
		)
	}

	public listWithdrawals(
		input: {
			recipient?: Address
			after?: number
			limit?: number
		} = {}
	): Promise<WithdrawalProof[]> {
		return this.#gateway.withdrawals(input)
	}

	public listWithdrawalRequests(
		input: {
			recipient?: Address
			after?: number
			limit?: number
		} = {}
	): Promise<WithdrawalRequest[]> {
		return this.#gateway.withdrawalRequests(input)
	}

	public getWithdrawal(settlementSequence: number, offset: number): Promise<WithdrawalProof> {
		return this.#gateway.withdrawal(settlementSequence, offset)
	}

	public async claimNativeWithdrawal(
		withdrawal: WithdrawalProof,
		account: Address = this.#account
	): Promise<Hash> {
		if (withdrawal.status !== "claimable") {
			throw new Error(`Withdrawal is ${withdrawal.status}, not claimable`)
		}
		if (withdrawal.siblings.length !== 16) {
			throw new Error("Native withdrawal proof must contain 16 siblings")
		}
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account,
			address: this.config.bridgeAddress,
			functionName: "claimNativeWithdrawal",
			chain: null,
			args: [
				BigInt(withdrawal.settlementSequence),
				withdrawal.offset,
				withdrawal.recipient,
				BigInt(withdrawal.amount),
				withdrawal.actionFieldsHash,
				withdrawal.siblings as [
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex,
					Hex
				]
			]
		})
		const receipt = await this.#publicClient.waitForTransactionReceipt({ hash })
		if (receipt.status !== "success") throw new Error(`Ethereum withdrawal claim ${hash} reverted`)
		return hash
	}

	public async waitForDeposit(nonce: number): Promise<DepositStatus> {
		let lastError: unknown
		for (let attempt = 0; attempt < 60; attempt++) {
			try {
				return await this.#gateway.deposit(nonce)
			} catch (error) {
				lastError = error
				await new Promise((resolve) => setTimeout(resolve, 1_000))
			}
		}
		throw lastError instanceof Error ? lastError : new Error(`Deposit ${nonce} was not indexed`)
	}

	private requireZekoBridge(): Bridge {
		if (!this.#bridge) {
			throw new Error("This operation requires the Zeko sequencer configuration")
		}
		return this.#bridge
	}
}
