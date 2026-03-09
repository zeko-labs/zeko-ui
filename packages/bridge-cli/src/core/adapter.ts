import { Bridge } from "../../../bridge-sdk/src/index"
import { PrivateKey, PublicKey, UInt32, UInt64, fetchTransactionStatus } from "o1js"
import { createExplorerUrl } from "./explorer"
import { nanominaToMinaString } from "./format"
import type { ChainRef, Direction, RouteDescriptor } from "./routes"
import { createSdkConfig } from "./sdk-config"
import { resolveSignerSecrets } from "./signer"
import type { DepositStatus, TransactionResult, WithdrawalStatus } from "./types"

export type BridgeAdapter = {
	getDepositStatuses(account: string): Promise<DepositStatus[]>
	getWithdrawalStatuses(account: string): Promise<WithdrawalStatus[]>
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

const routeKey = (route: RouteDescriptor) => `${route.from}->${route.to}`

const getBridge = (route: RouteDescriptor) => {
	const key = routeKey(route)
	const cached = bridges.get(key)
	if (cached) return cached

	const bridge = Bridge.init(createSdkConfig(route))
	bridges.set(key, bridge)
	return bridge
}

const resolvePublicKey = ({
	account,
	secrets,
	network
}: {
	account?: string
	secrets: ReturnType<typeof resolveSignerSecrets>
	network: ChainRef
}): { publicKey: PublicKey; signer: PrivateKey } => {
	const secret = network.startsWith("zeko:")
		? secrets.zeko
		: network.startsWith("eth:")
			? secrets.eth
			: secrets.mina

	if (!secret) {
		throw new Error(`Missing required signing secret for ${network}`)
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
		const status = await fetchTransactionStatus(zkAppId, graphqlUrl)
		if (status === "INCLUDED") return true
		if (status !== "PENDING") return false
		await new Promise((resolve) => setTimeout(resolve, 2_000))
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
	env = process.env
}: {
	route: RouteDescriptor
	env?: Partial<Record<string, string | undefined>>
}): BridgeAdapter => {
	const secrets = resolveSignerSecrets(env)

	return {
		async getDepositStatuses(account) {
			const bridge = await getBridge(route)
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
			const bridge = await getBridge(route)
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
			const bridge = await getBridge(route)
			const { publicKey, signer } = resolvePublicKey({ account, secrets, network: route.from })
			const currentSlot = await bridge.fetchCurrentSlot()
			const timeout =
				timeoutSlots === undefined ? UInt32.MAXINT() : currentSlot.add(UInt32.from(timeoutSlots))
			const tx = await bridge.submitDeposit(
				{ sender: publicKey, fee: 0.1 * 10e8 },
				{ recipient: publicKey, amount: UInt64.from(Number(amount) * 10e8), timeout }
			)
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "submit", direction: "deposit", route, result, wait })
		},
		async finalizeDeposit({ account, wait }) {
			const bridge = await getBridge(route)
			const { publicKey, signer } = resolvePublicKey({ account, secrets, network: route.to })
			const tx = await bridge.finalizeDeposit(publicKey)
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "finalize", direction: "deposit", route, result, wait })
		},
		async cancelDeposit({ account, wait }) {
			const bridge = await getBridge(route)
			const { publicKey, signer } = resolvePublicKey({ account, secrets, network: route.from })
			const tx = await bridge.cancelDeposit(publicKey, { sender: publicKey, fee: 0.1 * 10e8 })
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "cancel", direction: "deposit", route, result, wait })
		},
		async submitWithdrawal({ account, amount, wait }) {
			const bridge = await getBridge(route)
			const { publicKey, signer } = resolvePublicKey({ account, secrets, network: route.from })
			const tx = await bridge.submitWithdrawal(
				{ sender: publicKey, fee: 0.1 * 10e8 },
				{ recipient: publicKey, amount: UInt64.from(Number(amount) * 10e8) }
			)
			const result = await tx.sign([signer]).send()
			return normalizeTxResult({ action: "submit", direction: "withdrawal", route, result, wait })
		},
		async finalizeWithdrawal({ account, wait }) {
			const bridge = await getBridge(route)
			const { publicKey, signer } = resolvePublicKey({ account, secrets, network: route.to })
			const tx = await bridge.finalizeWithdrawal(publicKey, { sender: publicKey, fee: 0.1 * 10e8 })
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
