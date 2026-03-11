import { Bridge } from "@zeko-labs/bridge-sdk"
import { PrivateKey, PublicKey, UInt32, UInt64, fetchTransactionStatus } from "o1js"
import { createExplorerUrl } from "./explorer"
import { minaStringToNanomina, nanominaToMinaString } from "./format"
import type { ChainRef, Direction, RouteDescriptor } from "./routes"
import { createSdkConfig } from "./sdk-config"
import { resolveSignerKeys } from "./signer"
import type { DepositStatus, TransactionResult, WithdrawalStatus } from "./types"

export type BridgeAdapter = {
	getDepositStatuses(account: string): Promise<DepositStatus[]>
	getWithdrawalStatuses(account: string): Promise<WithdrawalStatus[]>
	canFinalizeDeposit?(account?: string): Promise<boolean>
	canCancelDeposit?(account?: string): Promise<boolean>
	canFinalizeWithdrawal?(account?: string): Promise<boolean>
	submitDeposit(input: {
		account?: string
		amount: string
		timeoutSlots?: number
		wait: boolean
	}): Promise<TransactionResult>
	finalizeDeposit(input: { account?: string; wait: boolean }): Promise<TransactionResult>
	cancelDeposit(input: { account?: string; wait: boolean }): Promise<TransactionResult>
	submitWithdrawal(input: {
		account?: string
		amount: string
		wait: boolean
	}): Promise<TransactionResult>
	finalizeWithdrawal(input: { account?: string; wait: boolean }): Promise<TransactionResult>
}

const bridges = new Map<string, Promise<Bridge>>()
const BRIDGE_FEE_NANOMINA = 100_000_000n

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
}): { publicKey: PublicKey; signer: PrivateKey } => {
	const secret = network.startsWith("zeko:")
		? keys.zeko
		: network.startsWith("eth:")
			? keys.eth
			: keys.mina

	if (!secret) {
		throw new Error(`Missing required signer private key for ${network}`)
	}

	const signer = PrivateKey.fromBase58(secret)
	const fallback = signer.toPublicKey().toBase58()
	return {
		publicKey: PublicKey.fromBase58(account ?? fallback),
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
			await new Promise((resolve) => setTimeout(resolve, 2_000))
		} catch {
			return false
		}
	}
}

const mapDirectionNetwork = ({
	action,
	route
}: {
	action: "submit" | "finalize" | "cancel"
	route: RouteDescriptor
}): ChainRef => {
	if (route.direction === "deposit") {
		if (action === "submit" || action === "cancel") return route.from
		return route.to
	}

	if (action === "submit") return route.from
	return route.to
}

const graphqlUrlForAction = ({
	action,
	route
}: {
	action: "submit" | "finalize" | "cancel"
	route: RouteDescriptor
}): string => {
	const config = createSdkConfig(route)
	return mapDirectionNetwork({ action, route }).startsWith("zeko:") ? config.zekoUrl : config.l1Url
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
	result: {
		hash?: string
		data?: {
			sendZkapp?: {
				zkapp?: {
					id?: string
				}
			}
		}
	}
	wait: boolean
}): Promise<TransactionResult> => {
	const hash = result.hash
	if (!hash) {
		throw new Error(`Transaction ${direction}:${action} did not return a hash`)
	}

	const zkAppId = result.data?.sendZkapp?.zkapp?.id
	const network = mapDirectionNetwork({ action, route })

	return {
		success: true,
		direction,
		action,
		route: `${route.from}->${route.to}`,
		hash,
		explorerUrl: createExplorerUrl(network, hash),
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
					synced: item.synced,
					accepted: item.accepted,
					confirmed: item.confirmed,
					finalised: item.finalised,
					hash: item.hash,
					timestamp: item.timestamp
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
					timestamp: item.timestamp
				})
			)
		},
		async submitDeposit({ account, amount, timeoutSlots, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const currentSlot = await bridge.fetchCurrentSlot()
			const timeout =
				timeoutSlots === undefined ? UInt32.MAXINT() : currentSlot.add(UInt32.from(timeoutSlots))
			const tx = await bridge.submitDeposit(
				{ sender: publicKey, fee: Number(BRIDGE_FEE_NANOMINA) },
				{ recipient: publicKey, amount: UInt64.from(minaStringToNanomina(amount)), timeout }
			)
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "submit", direction: "deposit", route, result, wait })
		},
		async canFinalizeDeposit(account) {
			const bridge = await getBridge(route, verbose)
			const { publicKey } = resolvePublicKey({ account, keys, network: route.to })
			return bridge.canFinalizeDeposit(publicKey)
		},
		async canCancelDeposit(account) {
			const bridge = await getBridge(route, verbose)
			const { publicKey } = resolvePublicKey({ account, keys, network: route.from })
			return bridge.canCancelDeposit(publicKey)
		},
		async finalizeDeposit({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.to })
			const tx = await bridge.finalizeDeposit(publicKey)
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "finalize", direction: "deposit", route, result, wait })
		},
		async cancelDeposit({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const tx = await bridge.cancelDeposit(publicKey, {
				sender: publicKey,
				fee: Number(BRIDGE_FEE_NANOMINA)
			})
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "cancel", direction: "deposit", route, result, wait })
		},
		async submitWithdrawal({ account, amount, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const tx = await bridge.submitWithdrawal(
				{ sender: publicKey, fee: Number(BRIDGE_FEE_NANOMINA) },
				{ recipient: publicKey, amount: UInt64.from(minaStringToNanomina(amount)) }
			)
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "submit", direction: "withdrawal", route, result, wait })
		},
		async canFinalizeWithdrawal(account) {
			const bridge = await getBridge(route, verbose)
			const { publicKey } = resolvePublicKey({ account, keys, network: route.to })
			return bridge.canFinalizeWithdrawal(publicKey)
		},
		async finalizeWithdrawal({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.to })
			const tx = await bridge.finalizeWithdrawal(publicKey, {
				sender: publicKey,
				fee: Number(BRIDGE_FEE_NANOMINA)
			})
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({
				action: "finalize",
				direction: "withdrawal",
				route,
				result,
				wait
			})
		}
	}
}
