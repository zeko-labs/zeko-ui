import {
	Bridge,
	isInsufficientFirstWithdrawalAmountError,
	type Config
} from "@zeko-labs/bridge-sdk"
import {
	PrivateKey,
	PublicKey,
	type Transaction as MinaTransaction,
	UInt32,
	UInt64,
	fetchTransactionStatus
} from "o1js"
import { formatErrorMessage, sleepFor } from "./utils"
import { formatRoute, resolveRoute } from "./routes"
import type {
	BridgeAdapter,
	BridgeAdapterFactory,
	ChainRef,
	DepositStatus,
	Direction,
	RouteDescriptor,
	SignedTransactionResult,
	TransactionResult,
	WithdrawalStatus
} from "./types"

const NANOMINA_PER_MINA = 1_000_000_000n
const DEFAULT_BRIDGE_FEE_NANOMINA = 100_000_000n
const WITHDRAWAL_SUBMIT_FEE_NANOMINA = 500_000_000n
export const DIRECT_MUTATION_RETRY_DELAY_MS = 5_000
export const DEFAULT_DEPOSIT_TIMEOUT_SLOTS = 720
export const MAX_FEE_RETRIES = 5

const TESTNET_CONFIG = {
	l1Url: "https://gateway.mina.devnet.zeko.io",
	l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
	zekoUrl: "https://testnet.zeko.io/graphql",
	zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql",
	actionsApi: "https://api.actions.zeko.io/graphql",
	l1Network: "testnet",
	l2Network: "testnet"
} as const satisfies Config

const MAINNET_CONFIG = {
	l1Url: "https://api.minascan.io/node/mainnet/v1/graphql",
	l1ArchiveUrl: "https://api.minascan.io/archive/mainnet/v1/graphql",
	zekoUrl: "https://mainnet.zeko.io/graphql",
	zekoArchiveUrl: "https://archive.mainnet.zeko.io/graphql",
	actionsApi: "https://api.actions.zeko.io/graphql",
	l1Network: "mainnet",
	l2Network: "mainnet"
} as const satisfies Config

const bridges = new Map<string, Promise<Bridge>>()

export const createSdkConfig = (
	route: RouteDescriptor,
	options: { verbose?: boolean } = {}
): Config => {
	if (!route.enabled) throw new Error(route.reason ?? `Bridge route ${route.label} is not enabled.`)
	if (route.from.includes("testnet") && route.to.includes("testnet")) {
		return { ...TESTNET_CONFIG, verbose: options.verbose === true }
	}
	if (route.from.includes("mainnet") && route.to.includes("mainnet")) {
		return { ...MAINNET_CONFIG, verbose: options.verbose === true }
	}
	throw new Error(`Unsupported network pairing for ${route.label}`)
}

export const minaStringToNanomina = (value: string): bigint => {
	const trimmed = value.trim()
	if (!/^\d+(?:\.\d{1,9})?$/.test(trimmed)) throw new Error(`Invalid MINA amount: ${value}`)
	const [wholePart = "0", fractionPart = ""] = trimmed.split(".")
	return BigInt(wholePart) * NANOMINA_PER_MINA + BigInt(fractionPart.padEnd(9, "0"))
}

const nanominaToMinaString = (value: bigint): string => {
	const whole = value / NANOMINA_PER_MINA
	const fraction = value % NANOMINA_PER_MINA
	return fraction === 0n
		? whole.toString()
		: `${whole.toString()}.${fraction.toString().padStart(9, "0").replace(/0+$/, "")}`
}

const normalizeStatusTimestamp = (timestamp: string): string => (timestamp === "0" ? "" : timestamp)

export const resolveDepositTimeoutSlots = (value?: number): number =>
	value ?? DEFAULT_DEPOSIT_TIMEOUT_SLOTS

export const resolveSignerKeys = (
	env: Partial<Record<string, string | undefined>> = process.env
) => {
	const mina = env.MINA_PRIVATE_KEY ?? env.BRIDGE_PRIVATE_KEY
	const zeko = env.ZEKO_PRIVATE_KEY ?? mina
	const eth = env.ETH_PRIVATE_KEY
	if (!mina && !zeko && !eth) {
		throw new Error("Missing wallet private key. Set MINA_PRIVATE_KEY or BRIDGE_PRIVATE_KEY.")
	}
	return { mina, zeko, eth }
}

export const deriveAccount = (from: ChainRef, explicit?: string): string => {
	if (explicit) return explicit
	const keys = resolveSignerKeys()
	const secret = from.startsWith("zeko:") ? keys.zeko : keys.mina
	if (!secret) throw new Error(`Missing required signer private key for ${from}`)
	return PrivateKey.fromBase58(secret).toPublicKey().toBase58()
}

const createExplorerUrl = (network: ChainRef, hash: string): string => {
	if (network.startsWith("zeko:")) return `https://zekoscan.io/testnet/tx/${hash}`
	if (network === "mina:mainnet") return `https://minascan.io/mainnet/tx/${hash}`
	return `https://minascan.io/devnet/tx/${hash}`
}

const routeKey = (route: RouteDescriptor, verbose: boolean) =>
	`${route.from}->${route.to}:verbose=${verbose ? "1" : "0"}`

const getBridge = (route: RouteDescriptor, verbose: boolean) => {
	const key = routeKey(route, verbose)
	const cached = bridges.get(key)
	if (cached) return cached
	const bridge = Bridge.init(createSdkConfig(route, { verbose })).catch((error: unknown) => {
		bridges.delete(key)
		throw error
	})
	bridges.set(key, bridge)
	return bridge
}

const resolvePublicKey = ({
	account,
	keys,
	network
}: {
	account?: string
	keys: ReturnType<typeof resolveSignerKeys>
	network: ChainRef
}) => {
	const secret = network.startsWith("zeko:")
		? keys.zeko
		: network.startsWith("eth:")
			? keys.eth
			: keys.mina
	if (!secret) throw new Error(`Missing required signer private key for ${network}`)
	const signer = PrivateKey.fromBase58(secret)
	return {
		publicKey: PublicKey.fromBase58(account ?? signer.toPublicKey().toBase58()),
		signer
	}
}

const waitForTransactionInclusion = async ({
	zkAppId,
	graphqlUrl
}: {
	zkAppId?: string
	graphqlUrl: string
}): Promise<boolean> => {
	if (!zkAppId) return false
	for (;;) {
		try {
			const status = await fetchTransactionStatus(zkAppId, graphqlUrl)
			if (status === "INCLUDED") return true
			if (status !== "PENDING") return false
			await sleepFor(2_000)
		} catch {
			return false
		}
	}
}

const isFeeTooLowError = (error: unknown): boolean => String(error).includes("Fee is too low")

export const sendWithFeeRetries = async <TTransaction, TResult>({
	createTransaction,
	initialFeeNanomina,
	sendTransaction
}: {
	createTransaction: (feeNanomina: bigint) => Promise<TTransaction>
	initialFeeNanomina: bigint
	sendTransaction: (transaction: TTransaction) => Promise<TResult>
}): Promise<TResult> => {
	let feeNanomina = initialFeeNanomina
	for (let retryCount = 0; ; retryCount += 1) {
		try {
			return await sendTransaction(await createTransaction(feeNanomina))
		} catch (error) {
			if (!isFeeTooLowError(error) || retryCount >= MAX_FEE_RETRIES) throw error
			feeNanomina *= 2n
		}
	}
}

const signSdkTransaction =
	(signer: PrivateKey) =>
	async (transaction: MinaTransaction<boolean, false>): Promise<MinaTransaction<boolean, true>> =>
		transaction.sign([signer]) as MinaTransaction<boolean, true>

const completedTx = (hash: string): SignedTransactionResult => ({ hash })

const useCompletedTx = async (
	transaction: SignedTransactionResult
): Promise<SignedTransactionResult> => transaction

const networkForAction = ({
	action,
	route
}: {
	action: "submit" | "finalize" | "cancel"
	route: RouteDescriptor
}): ChainRef => {
	if (route.direction === "deposit") return action === "finalize" ? route.to : route.from
	return action === "submit" ? route.from : route.to
}

const graphqlUrlForAction = ({
	action,
	route
}: {
	action: "submit" | "finalize" | "cancel"
	route: RouteDescriptor
}): string => {
	const config = createSdkConfig(route)
	return networkForAction({ action, route }).startsWith("zeko:") ? config.zekoUrl : config.l1Url
}

const normalizeTxResult = async ({
	action,
	direction,
	route,
	result,
	wait
}: {
	action: "submit" | "finalize" | "cancel"
	direction: Direction
	route: RouteDescriptor
	result: SignedTransactionResult
	wait: boolean
}): Promise<TransactionResult> => {
	if (!result.hash) throw new Error(`Transaction ${direction}:${action} did not return a hash`)
	const network = networkForAction({ action, route })
	const zkAppId = result.data?.sendZkapp?.zkapp?.id
	return {
		success: true,
		direction,
		action,
		route: formatRoute(route.from, route.to),
		hash: result.hash,
		explorerUrl: createExplorerUrl(network, result.hash),
		included: wait
			? await waitForTransactionInclusion({
					zkAppId,
					graphqlUrl: graphqlUrlForAction({ action, route })
				})
			: false,
		zkAppId
	}
}

export const createBridgeAdapter = ({
	route,
	env = process.env,
	verbose = false
}: {
	route: RouteDescriptor
	env?: Partial<Record<string, string | undefined>>
	verbose?: boolean
}): BridgeAdapter => {
	const keys = resolveSignerKeys(env)
	return {
		async getDepositStatuses(account) {
			const bridge = await getBridge(route, verbose)
			const result = await bridge.fetchDepositsWithStates(PublicKey.fromBase58(account))
			return result.deposits.map(
				(item): DepositStatus => ({
					index: item.index,
					amount: nanominaToMinaString(item.amount.toBigInt()),
					recipient: item.recipient.toBase58(),
					cancelled: item.cancelled,
					cancellable: item.cancellable,
					synced: item.synced,
					accepted: item.accepted,
					confirmed: item.confirmed,
					finalised: item.finalised,
					hash: item.hash,
					timestamp: normalizeStatusTimestamp(item.timestamp)
				})
			)
		},
		async getWithdrawalStatuses(account) {
			const bridge = await getBridge(route, verbose)
			const result = await bridge.fetchWithdrawalsWithStates(PublicKey.fromBase58(account))
			return result.withdrawals.map(
				(item): WithdrawalStatus => ({
					index: item.index,
					amount: nanominaToMinaString(item.amount.toBigInt()),
					recipient: item.recipient.toBase58(),
					committed: item.committed,
					finalised: item.finalised,
					hash: item.hash,
					timestamp: normalizeStatusTimestamp(item.timestamp)
				})
			)
		},
		async submitDeposit({ account, recipient, amount, timeoutSlots, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const { publicKey: recipientPublicKey } = resolvePublicKey({
				account: recipient,
				keys,
				network: route.to
			})
			const timeout = (await bridge.fetchCurrentSlot()).add(
				UInt32.from(resolveDepositTimeoutSlots(timeoutSlots))
			)
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.submitDeposit(
							{ sender: publicKey, fee: Number(feeNanomina) },
							{
								recipient: recipientPublicKey,
								amount: UInt64.from(minaStringToNanomina(amount)),
								timeout
							},
							signSdkTransaction(signer)
						)
					)
			})
			return normalizeTxResult({ action: "submit", direction: "deposit", route, result, wait })
		},
		async canFinalizeDeposit(account) {
			const bridge = await getBridge(route, verbose)
			return bridge.canFinalizeDeposit(
				resolvePublicKey({ account, keys, network: route.to }).publicKey
			)
		},
		async canCancelDeposit(account) {
			const bridge = await getBridge(route, verbose)
			return bridge.canCancelDeposit(
				resolvePublicKey({ account, keys, network: route.from }).publicKey
			)
		},
		async finalizeDeposit({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.to })
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.finalizeDeposit(publicKey, signSdkTransaction(signer), { feeNanomina })
					)
			})
			return normalizeTxResult({ action: "finalize", direction: "deposit", route, result, wait })
		},
		async cancelDeposit({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.cancelDeposit(publicKey, signSdkTransaction(signer), undefined, {
							feeNanomina
						})
					)
			})
			return normalizeTxResult({ action: "cancel", direction: "deposit", route, result, wait })
		},
		async submitWithdrawal({ account, recipient, amount, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const { publicKey: recipientPublicKey } = resolvePublicKey({
				account: recipient,
				keys,
				network: route.to
			})
			const result = await sendWithFeeRetries({
				initialFeeNanomina: WITHDRAWAL_SUBMIT_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.submitWithdrawal(
							{ sender: publicKey, fee: Number(feeNanomina) },
							{ recipient: recipientPublicKey, amount: UInt64.from(minaStringToNanomina(amount)) },
							signSdkTransaction(signer)
						)
					)
			})
			return normalizeTxResult({ action: "submit", direction: "withdrawal", route, result, wait })
		},
		async canFinalizeWithdrawal(account) {
			const bridge = await getBridge(route, verbose)
			return bridge.canFinalizeWithdrawal(
				resolvePublicKey({ account, keys, network: route.to }).publicKey
			)
		},
		async finalizeWithdrawal({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.to })
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.finalizeWithdrawal(publicKey, signSdkTransaction(signer), undefined, {
							feeNanomina
						})
					)
			})
			return normalizeTxResult({ action: "finalize", direction: "withdrawal", route, result, wait })
		}
	}
}

export const createDefaultBridgeAdapter: BridgeAdapterFactory = async ({ from, to, verbose }) =>
	createBridgeAdapter({ route: resolveRoute(from, to), verbose })

export const isRecoverableMutationError = (error: unknown): boolean => {
	const message = formatErrorMessage(error)
	return (
		/Failed to fetch|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|Failed to fetch proved forest|No key returned from mutation/i.test(
			message
		) && !isInsufficientFirstWithdrawalAmountError(error)
	)
}
