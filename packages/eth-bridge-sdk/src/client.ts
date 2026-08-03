import {
	Bridge,
	type BridgeRuntime,
	type Config,
	createBridgeRuntime,
	type Deposit,
	type DepositWithState,
	ETHEREUM_ASSET_REGISTRY_DEPTH,
	type EthereumAssetsConfig,
	type EthereumTokenBridgeConfig,
	type EthereumTokenDepositSelection,
	type EthereumTokenSolidityRegistration,
	ethereumAssetRecordCommitment,
	ethereumAssetRegistryFieldHex,
	ethereumAssetRegistryLeaf,
	ethereumDepositAux,
	fetchEthereumAsset,
	type RetryableTransactionOptions,
	type SignTransaction,
	type EthereumAssetRecord as ZekoEthereumAssetRecord
} from "@zeko-labs/bridge-sdk"
import { Field, type Mina, type PublicKey, UInt32, UInt64 } from "o1js"
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
	type TokenWithdrawalProof,
	type WithdrawalProof,
	type WithdrawalRequest
} from "./gateway"
import {
	type EthereumAssetMembership,
	type EthereumAssetRecord,
	EthereumAssetRegistry,
	type EthereumAssetRegistryAnchor,
	type EthereumAssetRegistryConfig,
	type EthereumAssetRegistrySnapshot,
	ethereumAssetRecordBatchMembership,
	hashEthereumAssetRecord,
	validateEthereumAssetProposal
} from "./registry"

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
	assets?: {
		snapshot: EthereumAssetRegistrySnapshot
		config?: EthereumAssetRegistryConfig
	}
}

export type NativeDepositResult = {
	hash: Hash
	nonce: number
	deposit: DepositStatus
}

export type TokenDepositResult = NativeDepositResult

export type EthereumAssetStatus = "none" | "pending" | "active" | "paused" | "disallowed"

export type EthereumAssetProposal = {
	record: EthereumAssetRecord
	status: EthereumAssetStatus
	recordHash: Hex
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

export const buildEthereumBridgeDeposit = async (input: {
	deposit: DepositStatus
	holderAccountL1: PublicKey
	resolveV2Asset: (assetId: Hex) => Promise<{ registryIndex: number; recordCommitment: Field }>
}): Promise<Deposit> => {
	const { deposit } = input
	const assetId = deposit.assetId ?? undefined
	const registry =
		assetId && deposit.encodingVersion === 2 ? await input.resolveV2Asset(assetId) : undefined
	return {
		recipient: unpackZekoAddress(deposit.zekoRecipient),
		amount: UInt64.from(deposit.zekoAmount),
		timeout: UInt32.from(deposit.timeout),
		holderAccountL1: input.holderAccountL1,
		assetId,
		encodingVersion: registry ? 2 : undefined,
		registryIndex: registry?.registryIndex,
		recordCommitment: registry?.recordCommitment
	}
}

export const ethereumTokenDepositSelection = (
	deposit: Pick<DepositStatus, "token" | "encodingVersion">
): EthereumTokenDepositSelection => {
	if (deposit.encodingVersion === null) {
		throw new Error("ERC20 deposit has no indexed action encoding version")
	}
	return {
		encodingVersion: deposit.encodingVersion,
		asset: { ethereumTokenAddress: getAddress(deposit.token) }
	}
}

type AuthenticatedEthereumAssets = Pick<
	EthereumAssetsConfig,
	| "approvedMftStandardVkId"
	| "registryCount"
	| "registryRoot"
	| "registrySchemaVersion"
	| "universalBridgeVkId"
	| "vaultPublicKey"
>

export const ethereumAssetRegistryRuntimeAnchor = (
	runtimeAssets: AuthenticatedEthereumAssets | null,
	depth: number
): EthereumAssetRegistryAnchor => {
	if (!runtimeAssets) {
		throw new Error(
			"Ethereum asset snapshot requires an authenticated Zeko runtime registry configuration"
		)
	}
	return {
		schemaVersion: runtimeAssets.registrySchemaVersion,
		depth,
		root: ethereumAssetRegistryFieldHex(runtimeAssets.registryRoot) as Hex,
		count: runtimeAssets.registryCount,
		mftStandardVkId: ethereumAssetRegistryFieldHex(runtimeAssets.approvedMftStandardVkId) as Hex,
		vaultPublicKey: packZekoAddress(runtimeAssets.vaultPublicKey),
		universalBridgeVkId: ethereumAssetRegistryFieldHex(runtimeAssets.universalBridgeVkId) as Hex
	}
}

export const authenticateEthereumAssetRegistrySnapshot = (
	input: NonNullable<EthereumBridgeClientConfig["assets"]>,
	runtimeAssets: AuthenticatedEthereumAssets | null
): EthereumAssetRegistry => {
	const anchor = ethereumAssetRegistryRuntimeAnchor(runtimeAssets, input.snapshot.depth)
	const registry = new EthereumAssetRegistry(input.snapshot, {
		schemaVersion: anchor.schemaVersion,
		depth: anchor.depth,
		mftStandardVkId: anchor.mftStandardVkId,
		vaultPublicKey: anchor.vaultPublicKey,
		universalBridgeVkId: anchor.universalBridgeVkId
	})
	if (
		anchor.root !== registry.root ||
		anchor.count !== registry.count ||
		anchor.schemaVersion !== registry.schemaVersion
	) {
		throw new Error(
			"Ethereum asset snapshot does not match the authenticated Zeko runtime root/count/schema"
		)
	}
	return registry
}

type EthereumBridgeRuntimeState = Readonly<{
	assets?: EthereumAssetRegistry
	bridge?: Bridge
}>

const createEthereumGatewayBridge = (input: {
	assets?: EthereumAssetRegistry
	config: BridgeConfig
	gateway: GatewayClient
	runtime: BridgeRuntime
}): Bridge => {
	const { assets, config, gateway, runtime } = input
	const ethereumHolder = ethereumAddressToZekoPublicKey(config.bridgeAddress)
	const runtimeAssets = runtime.ethereumAssets
	return new Bridge({
		...runtime,
		bridge: {
			depositAux: ethereumDepositAux,
			fetchCurrentSlot: async () => UInt32.from((await gateway.config()).currentVirtualSlot),
			fetchUserDeposits: async (recipient: PublicKey) => {
				const deposits = await gateway.deposits({
					zekoRecipient: packZekoAddress(recipient)
				})
				return Promise.all(
					deposits.map((deposit) =>
						buildEthereumBridgeDeposit({
							deposit,
							holderAccountL1: ethereumHolder,
							resolveV2Asset: async (assetId) => {
								const localAsset = assets?.byAssetId(assetId).record
								if (localAsset) {
									return {
										registryIndex: localAsset.registryIndex,
										recordCommitment: ethereumAssetRegistryLeaf(localAsset)
									}
								}
								if (!runtimeAssets) {
									throw new Error(
										"Ethereum ERC20 V2 deposit requires an authenticated registry record"
									)
								}
								const indexedAsset = (
									await fetchEthereumAsset(runtime, {
										assetId
									})
								).membership.record
								return {
									registryIndex: indexedAsset.registryIndex,
									recordCommitment: ethereumAssetRecordCommitment(indexedAsset)
								}
							}
						})
					)
				)
			}
		}
	})
}

export class EthereumBridgeClient {
	readonly #account: Address
	readonly #gateway: GatewayClient
	readonly #publicClient: ReturnType<typeof createPublicClient>
	readonly #refreshRuntime?: (
		snapshot: EthereumAssetRegistrySnapshot,
		currentAssets?: EthereumAssetRegistry
	) => Promise<Required<EthereumBridgeRuntimeState>>
	#assetRefreshTail: Promise<void> = Promise.resolve()
	#runtimeState: EthereumBridgeRuntimeState
	readonly #walletClient: ReturnType<typeof createWalletClient>

	public readonly config: BridgeConfig

	private constructor(input: {
		account: Address
		config: BridgeConfig
		gateway: GatewayClient
		provider: EIP1193Provider
		refreshRuntime?: (
			snapshot: EthereumAssetRegistrySnapshot,
			currentAssets?: EthereumAssetRegistry
		) => Promise<Required<EthereumBridgeRuntimeState>>
		runtimeState: EthereumBridgeRuntimeState
	}) {
		this.#account = input.account
		this.config = input.config
		this.#gateway = input.gateway
		this.#refreshRuntime = input.refreshRuntime
		this.#runtimeState = input.runtimeState
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
		let assets = input.assets
			? new EthereumAssetRegistry(input.assets.snapshot, input.assets.config)
			: undefined

		let runtimeState: EthereumBridgeRuntimeState = { assets }
		let refreshRuntime:
			| ((
					snapshot: EthereumAssetRegistrySnapshot,
					currentAssets?: EthereumAssetRegistry
			  ) => Promise<Required<EthereumBridgeRuntimeState>>)
			| undefined
		if (input.zeko) {
			const runtimeConfig = {
				...input.zeko,
				l1Url: gateway.graphqlUrl,
				l1ArchiveUrl: gateway.graphqlUrl,
				v2DepositsStartIndex: input.zeko.v2DepositsStartIndex ?? 0,
				v2WithdrawalsStartIndex: input.zeko.v2WithdrawalsStartIndex ?? 0
			}
			const fetchRuntime = () => createBridgeRuntime(runtimeConfig)
			const runtime = await fetchRuntime()
			const runtimeAssets = runtime.ethereumAssets
			if (input.assets) {
				assets = authenticateEthereumAssetRegistrySnapshot(input.assets, runtimeAssets)
			}
			runtimeState = {
				assets,
				bridge: createEthereumGatewayBridge({ assets, config, gateway, runtime })
			}
			refreshRuntime = async (snapshot, currentAssets) => {
				const freshRuntime = await fetchRuntime()
				const freshRuntimeAssets = freshRuntime.ethereumAssets
				const refreshed = currentAssets
					? currentAssets.refresh(
							snapshot,
							ethereumAssetRegistryRuntimeAnchor(freshRuntimeAssets, snapshot.depth)
						)
					: authenticateEthereumAssetRegistrySnapshot({ snapshot }, freshRuntimeAssets)
				return {
					assets: refreshed,
					bridge: createEthereumGatewayBridge({
						assets: refreshed,
						config,
						gateway,
						runtime: freshRuntime
					})
				}
			}
		}

		return new EthereumBridgeClient({
			account: getAddress(account),
			config,
			gateway,
			provider: input.provider,
			refreshRuntime,
			runtimeState
		})
	}

	public get account(): Address {
		return this.#account
	}

	public get ethereumToken(): EthereumTokenBridgeConfig | null {
		return this.#runtimeState.bridge?.ethereumToken ?? null
	}

	public getZekoAsset(token: Address) {
		return this.requireZekoBridge().fetchEthereumAsset({
			ethereumTokenAddress: getAddress(token)
		})
	}

	public get assetRegistry(): EthereumAssetRegistry | null {
		return this.#runtimeState.assets ?? null
	}

	public async refreshAssetRegistry(
		snapshot: EthereumAssetRegistrySnapshot
	): Promise<EthereumAssetRegistry> {
		const refreshRuntime = this.#refreshRuntime
		if (!refreshRuntime) {
			throw new Error("Registry refresh requires an authenticated Zeko runtime")
		}
		const refresh = this.#assetRefreshTail.then(async () => {
			const refreshed = await refreshRuntime(snapshot, this.#runtimeState.assets)
			this.#runtimeState = refreshed
			return refreshed.assets
		})
		this.#assetRefreshTail = refresh.then(
			() => undefined,
			() => undefined
		)
		return refresh
	}

	public getAssetMembership(token: Address): EthereumAssetMembership {
		const assets = this.#runtimeState.assets
		if (!assets) throw new Error("Universal Ethereum asset registry is not configured")
		return assets.membership(assets.byEthereumToken(token).record)
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

	public async depositToken(input: {
		token: Address
		recipient: PublicKey
		amount: bigint
	}): Promise<TokenDepositResult> {
		if (this.#runtimeState.assets) {
			this.getAssetMembership(input.token)
		} else if (this.#runtimeState.bridge?.ethereumAssets) {
			await this.#runtimeState.bridge.fetchEthereumAsset({
				ethereumTokenAddress: getAddress(input.token)
			})
		}
		const configuredToken = this.#runtimeState.bridge?.ethereumAssets
			? undefined
			: this.#runtimeState.bridge?.ethereumToken?.ethereumTokenAddress
		if (configuredToken && getAddress(configuredToken) !== getAddress(input.token)) {
			throw new Error("Ethereum token does not match the ERC20 asset configured on Zeko")
		}
		if (input.amount <= 0n || input.amount > 2n ** 64n - 1n) {
			throw new Error("ERC20 deposit amount must fit Zeko UInt64")
		}
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account: this.#account,
			address: this.config.bridgeAddress,
			functionName: "submitDeposit",
			args: [getAddress(input.token), input.amount, BigInt(packZekoAddress(input.recipient))],
			chain: null
		})
		const receipt = await this.#publicClient.waitForTransactionReceipt({ hash })
		if (receipt.status !== "success") throw new Error(`Ethereum token deposit ${hash} reverted`)
		let nonce: number | undefined
		for (const log of receipt.logs) {
			if (getAddress(log.address) !== this.config.bridgeAddress) continue
			try {
				const event = decodeEventLog({
					abi: ethereumZekoBridgeAbi,
					data: log.data,
					topics: log.topics
				})
				if (
					event.eventName === "BridgeDeposit" &&
					getAddress(event.args.token) === getAddress(input.token)
				) {
					nonce = Number(event.args.nonce)
				}
			} catch {
				// Ignore unrelated bridge logs from the same receipt.
			}
		}
		if (nonce === undefined) {
			throw new Error(`Ethereum token deposit ${hash} emitted no matching BridgeDeposit`)
		}
		return { hash, nonce, deposit: await this.waitForDeposit(nonce) }
	}

	public async getTokenRegistration(token: Address): Promise<EthereumTokenSolidityRegistration> {
		const ethereumTokenAddress = getAddress(token)
		const contract = {
			abi: ethereumZekoBridgeAbi,
			address: this.config.bridgeAddress,
			args: [ethereumTokenAddress]
		} as const
		const [registered, assetId, tokenOwner, tokenId, depositCap, tokenConfig] = await Promise.all([
			this.#publicClient.readContract({
				...contract,
				functionName: "canonicalTokenRegistered"
			}),
			this.#publicClient.readContract({ ...contract, functionName: "assetIdByToken" }),
			this.#publicClient.readContract({
				...contract,
				functionName: "zekoTokenOwnerByToken"
			}),
			this.#publicClient.readContract({ ...contract, functionName: "zekoTokenIdByToken" }),
			this.#publicClient.readContract({ ...contract, functionName: "depositCapByToken" }),
			this.#publicClient.readContract({ ...contract, functionName: "allowedToken" })
		])
		const [zekoDecimals, ethereumDecimals, allowed] = tokenConfig
		return {
			registered,
			allowed,
			assetId,
			ethereumTokenAddress,
			zekoTokenOwnerL2: unpackZekoAddress(tokenOwner),
			zekoTokenIdL2: Field(BigInt(tokenId)),
			zekoDecimals,
			ethereumDecimals,
			depositCap: UInt64.from(depositCap)
		}
	}

	public async getAssetProposal(token: Address): Promise<EthereumAssetProposal> {
		const ethereumTokenAddress = getAddress(token)
		const contract = {
			abi: ethereumZekoBridgeAbi,
			address: this.config.bridgeAddress,
			args: [ethereumTokenAddress]
		} as const
		const [record, status] = await Promise.all([
			this.#publicClient.readContract({ ...contract, functionName: "assetRecord" }),
			this.#publicClient.readContract({ ...contract, functionName: "assetStatusByToken" })
		])
		const normalized: EthereumAssetRecord = {
			schemaVersion: Number(record.schemaVersion),
			registryIndex: Number(record.registryIndex),
			assetId: record.assetId,
			ethereumTokenAddress: getAddress(record.ethereumToken),
			tokenOwnerL2: record.tokenOwnerL2,
			tokenIdL2: record.tokenIdL2,
			decimals: Number(record.decimals),
			inventoryCap: record.inventoryCap,
			mftStandardVkId: record.mftStandardVkId,
			vaultPublicKey: record.vaultPublicKey,
			universalBridgeVkId: record.universalBridgeVkId
		}
		const statuses: EthereumAssetStatus[] = ["none", "pending", "active", "paused", "disallowed"]
		const resolvedStatus = statuses[status]
		if (!resolvedStatus) throw new Error(`Unsupported Ethereum asset status ${status}`)
		return {
			record: normalized,
			status: resolvedStatus,
			recordHash: hashEthereumAssetRecord(normalized)
		}
	}

	public async proposeAsset(record: EthereumAssetRecord): Promise<Hash> {
		const anchor = ethereumAssetRegistryRuntimeAnchor(
			this.#runtimeState.bridge?.ethereumAssets ?? null,
			ETHEREUM_ASSET_REGISTRY_DEPTH
		)
		const validatedRecord = validateEthereumAssetProposal(record, anchor)
		hashEthereumAssetRecord(validatedRecord)
		const expectedIndex = await this.#publicClient.readContract({
			abi: ethereumZekoBridgeAbi,
			address: this.config.bridgeAddress,
			functionName: "proposedAssetCount"
		})
		if (validatedRecord.registryIndex !== expectedIndex) {
			throw new Error(
				`Ethereum asset proposal index ${validatedRecord.registryIndex} does not match next index ${expectedIndex}`
			)
		}
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account: this.#account,
			address: this.config.bridgeAddress,
			functionName: "proposeAsset",
			args: [
				{
					schemaVersion: validatedRecord.schemaVersion,
					registryIndex: validatedRecord.registryIndex,
					assetId: validatedRecord.assetId,
					ethereumToken: getAddress(validatedRecord.ethereumTokenAddress),
					tokenOwnerL2: validatedRecord.tokenOwnerL2,
					tokenIdL2: validatedRecord.tokenIdL2,
					decimals: validatedRecord.decimals,
					inventoryCap: validatedRecord.inventoryCap,
					mftStandardVkId: validatedRecord.mftStandardVkId,
					vaultPublicKey: validatedRecord.vaultPublicKey,
					universalBridgeVkId: validatedRecord.universalBridgeVkId
				}
			],
			chain: null
		})
		const receipt = await this.#publicClient.waitForTransactionReceipt({ hash })
		if (receipt.status !== "success") throw new Error(`Ethereum asset proposal ${hash} reverted`)
		return hash
	}

	public async cancelLastPendingAsset(token: Address): Promise<Hash> {
		const ethereumTokenAddress = getAddress(token)
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account: this.#account,
			address: this.config.bridgeAddress,
			functionName: "cancelLastPendingAsset",
			args: [ethereumTokenAddress],
			chain: null
		})
		const receipt = await this.#publicClient.waitForTransactionReceipt({ hash })
		if (receipt.status !== "success") {
			throw new Error(`Ethereum asset proposal cancellation ${hash} reverted`)
		}
		return hash
	}

	public async registerProposedAsset(input: {
		token: Address
		feePayer: Mina.FeePayerSpec
		signTransaction: SignTransaction
		options?: RetryableTransactionOptions
	}): Promise<string> {
		const proposal = await this.getAssetProposal(input.token)
		if (proposal.status !== "pending") {
			throw new Error(
				`Ethereum asset ${proposal.record.ethereumTokenAddress} is ${proposal.status}, expected pending`
			)
		}
		return this.registerAssetRecord({
			...input,
			record: proposal.record
		})
	}

	public async registerAssetRecord(input: {
		record: EthereumAssetRecord
		feePayer: Mina.FeePayerSpec
		signTransaction: SignTransaction
		options?: RetryableTransactionOptions
	}): Promise<string> {
		const record: ZekoEthereumAssetRecord = {
			schemaVersion: input.record.schemaVersion,
			registryIndex: input.record.registryIndex,
			assetId: input.record.assetId,
			ethereumTokenAddress: input.record.ethereumTokenAddress,
			tokenOwnerL2: unpackZekoAddress(input.record.tokenOwnerL2),
			tokenIdL2: Field(BigInt(input.record.tokenIdL2)),
			decimals: input.record.decimals,
			inventoryCap: UInt64.from(input.record.inventoryCap),
			mftStandardVkId: Field(BigInt(input.record.mftStandardVkId)),
			vaultPublicKey: unpackZekoAddress(input.record.vaultPublicKey),
			universalBridgeVkId: Field(BigInt(input.record.universalBridgeVkId))
		}
		return this.requireZekoBridge().registerEthereumAsset(
			input.feePayer,
			record,
			input.signTransaction,
			input.options
		)
	}

	public async activateAsset(input: { token: Address; root: Hex; count: number }): Promise<Hash> {
		const membership = this.getAssetMembership(input.token)
		if (membership.root !== input.root.toLowerCase() || membership.count !== input.count) {
			throw new Error("Ethereum asset activation does not match the authenticated SDK snapshot")
		}
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account: this.#account,
			address: this.config.bridgeAddress,
			functionName: "activateAsset",
			args: [getAddress(input.token), input.root, input.count],
			chain: null
		})
		const receipt = await this.#publicClient.waitForTransactionReceipt({ hash })
		if (receipt.status !== "success") throw new Error(`Ethereum asset activation ${hash} reverted`)
		return hash
	}

	public async activateAssetFromBatch(input: {
		token: Address
		settlementSequence: bigint
		batchRecords: readonly EthereumAssetRecord[]
	}): Promise<Hash> {
		const proposal = await this.getAssetProposal(input.token)
		if (proposal.status !== "pending") {
			throw new Error(
				`Ethereum asset ${proposal.record.ethereumTokenAddress} is ${proposal.status}, expected pending`
			)
		}
		const membership = ethereumAssetRecordBatchMembership(input.batchRecords, proposal.record)
		if (membership.proof.length !== 8) {
			throw new Error("Ethereum asset record batch proof has the wrong depth")
		}
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account: this.#account,
			address: this.config.bridgeAddress,
			functionName: "activateAssetFromBatch",
			args: [
				getAddress(input.token),
				input.settlementSequence,
				membership.recordCommitment,
				membership.proof as readonly [Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex]
			],
			chain: null
		})
		const receipt = await this.#publicClient.waitForTransactionReceipt({ hash })
		if (receipt.status !== "success") {
			throw new Error(`Ethereum asset batch activation ${hash} reverted`)
		}
		return hash
	}

	public getDeposit(nonce: number): Promise<DepositStatus> {
		return this.#gateway.deposit(nonce)
	}

	public listDeposits(
		input: { recipient?: PublicKey; after?: number; limit?: number } = {}
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
		const deposits = await this.listDeposits(input)
		const bridge = this.requireZekoBridge()
		const selections = new Map<string, EthereumTokenDepositSelection>()
		for (const deposit of deposits) {
			if (deposit.assetId === null || deposit.encodingVersion === null) continue
			const selection = ethereumTokenDepositSelection(deposit)
			selections.set(
				`${selection.encodingVersion}:${getAddress(deposit.token).toLowerCase()}`,
				selection
			)
		}
		const states = await Promise.all([
			bridge.fetchDepositsWithStates(input.recipient, (deposit) => deposit.assetId === undefined),
			...Array.from(selections.values(), (selection) =>
				bridge.fetchEthereumTokenDepositsWithStates(input.recipient, selection)
			)
		])
		return mergeDepositActivity(
			deposits,
			states.flatMap(({ deposits: stateDeposits }) => stateDeposits)
		)
	}

	public prepareDepositFinalization(recipient: PublicKey) {
		return this.requireZekoBridge().canFinalizeDeposit(recipient)
	}

	public prepareTokenDepositFinalization(
		recipient: PublicKey,
		deposit: Pick<DepositStatus, "token" | "encodingVersion"> | Address
	) {
		return this.requireZekoBridge().canFinalizeEthereumTokenDeposit(
			recipient,
			typeof deposit === "string"
				? { ethereumTokenAddress: getAddress(deposit) }
				: ethereumTokenDepositSelection(deposit)
		)
	}

	public finalizeDeposit(
		recipient: PublicKey,
		signTransaction: SignTransaction,
		options?: number | RetryableTransactionOptions
	): Promise<string> {
		return this.requireZekoBridge().finalizeDeposit(recipient, signTransaction, options)
	}

	public finalizeTokenDeposit(input: {
		feePayer: Mina.FeePayerSpec
		recipient: PublicKey
		token: Address
		encodingVersion?: 1 | 2
		signTransaction: SignTransaction
		options?: number | RetryableTransactionOptions
	}): Promise<string> {
		return this.requireZekoBridge().finalizeEthereumTokenDeposit(
			input.feePayer,
			input.recipient,
			input.encodingVersion === undefined
				? { ethereumTokenAddress: getAddress(input.token) }
				: ethereumTokenDepositSelection({
						token: input.token,
						encodingVersion: input.encodingVersion
					}),
			input.signTransaction,
			input.options
		)
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

	public requestTokenWithdrawal(input: {
		feePayer: Mina.FeePayerSpec
		sender: PublicKey
		recipient: Address
		token: Address
		amount: UInt64
		signTransaction: SignTransaction
		options?: RetryableTransactionOptions
	}): Promise<string> {
		return this.requireZekoBridge().submitEthereumTokenWithdrawal(
			input.feePayer,
			{
				sender: input.sender,
				recipient: ethereumAddressToZekoPublicKey(input.recipient),
				amount: input.amount,
				asset: { ethereumTokenAddress: getAddress(input.token) }
			},
			input.signTransaction,
			input.options
		)
	}

	public listWithdrawals(
		input: { recipient?: Address; after?: number; limit?: number } = {}
	): Promise<WithdrawalProof[]> {
		return this.#gateway.withdrawals(input)
	}

	public listWithdrawalRequests(
		input: { recipient?: Address; after?: number; limit?: number } = {}
	): Promise<WithdrawalRequest[]> {
		return this.#gateway.withdrawalRequests(input)
	}

	public getWithdrawal(settlementSequence: number, offset: number): Promise<WithdrawalProof> {
		return this.#gateway.withdrawal(settlementSequence, offset)
	}

	public getTokenWithdrawal(
		settlementSequence: number,
		offset: number
	): Promise<TokenWithdrawalProof> {
		return this.#gateway.tokenWithdrawal(settlementSequence, offset)
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

	public async claimTokenWithdrawal(
		withdrawal: TokenWithdrawalProof,
		account: Address = this.#account
	): Promise<Hash> {
		if (withdrawal.status !== "claimable") {
			throw new Error(`Withdrawal is ${withdrawal.status}, not claimable`)
		}
		if (withdrawal.siblings.length !== 16) {
			throw new Error("ERC20 withdrawal proof must contain 16 siblings")
		}
		const hash = await this.#walletClient.writeContract({
			abi: ethereumZekoBridgeAbi,
			account,
			address: this.config.bridgeAddress,
			functionName: "claimERC20Withdrawal",
			chain: null,
			args: [
				BigInt(withdrawal.settlementSequence),
				withdrawal.offset,
				withdrawal.token,
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
		if (receipt.status !== "success") {
			throw new Error(`Ethereum ERC20 withdrawal claim ${hash} reverted`)
		}
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
		if (!this.#runtimeState.bridge) {
			throw new Error("This operation requires the Zeko sequencer configuration")
		}
		return this.#runtimeState.bridge
	}
}
