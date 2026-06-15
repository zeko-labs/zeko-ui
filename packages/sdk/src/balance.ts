import type { AuroWalletNetwork } from "@zeko/networks"
import { PublicKey, TokenId } from "o1js"
import { fromCallback } from "xstate"
import type { WalletEmit, WalletEvent } from "./events"
import { logger } from "./logger"
import { AURO_NETWORK_LABELS, AURO_NETWORK_URLS, AURO_NETWORKS } from "./networks"

type TokenIdentifier = string

interface TokenInfo {
	symbol: string
	balance: number
}

export type Balance = Record<AuroWalletNetwork, Record<TokenIdentifier, TokenInfo>>

export type CustomToken = SimpleToken | PoolToken

export interface SimpleToken {
	address: string
	symbol: string
	decimal: number
	tokenId: string
}

export interface PoolToken {
	poolAddress: string
	decimal: number
	symbol: string
}

export interface FetchBalanceInput {
	address: string
	tokens: CustomToken[]
	network: AuroWalletNetwork
}

export const emptyNetworkBalance = (): Balance => ({
	[AURO_NETWORKS.minaMainnet]: { MINA: { symbol: "MINA", balance: 0 } },
	[AURO_NETWORKS.minaDevnet]: { MINA: { symbol: "MINA", balance: 0 } },
	[AURO_NETWORKS.zekoTestnet]: { MINA: { symbol: "MINA", balance: 0 } },
	[AURO_NETWORKS.zekoMainnet]: { MINA: { symbol: "MINA", balance: 0 } }
})

const toNumber = (value: unknown) => {
	if (typeof value === "number") return value
	if (typeof value !== "string") return 0
	const parsed = Number.parseFloat(value)
	return Number.isNaN(parsed) ? 0 : parsed
}

const fetchAccountBalance = async ({
	address,
	network,
	tokenId
}: {
	address: string
	network: AuroWalletNetwork
	tokenId?: string
}) => {
	const response = await fetch(AURO_NETWORK_URLS[network], {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			query: `query AccountBalance($publicKey: PublicKey!, $tokenId: Field) {
				account(publicKey: $publicKey, tokenId: $tokenId) {
					balance { total }
				}
			}`,
			variables: { publicKey: address, tokenId: tokenId ?? null }
		})
	})
	if (!response.ok)
		throw new Error(`Unable to fetch account balance from ${AURO_NETWORK_LABELS[network]}.`)
	const data = (await response.json()) as {
		data?: { account?: { balance?: { total?: string | number } } }
	}
	return toNumber(data.data?.account?.balance?.total)
}

const fetchBalanceLogic = async ({
	address,
	tokens,
	network
}: FetchBalanceInput): Promise<Partial<Balance>> => {
	const mina = { symbol: "MINA", decimal: 1e9, tokenId: undefined }
	const allTokens = [
		mina,
		...tokens
			.filter((token) => token.symbol !== "MINA")
			.map((token) => ({
				symbol: token.symbol,
				decimal: token.decimal,
				tokenId:
					"poolAddress" in token
						? TokenId.toBase58(TokenId.derive(PublicKey.fromBase58(token.poolAddress)))
						: token.tokenId
			}))
	]

	const entries = await Promise.all(
		allTokens.map(async (token) => {
			const total = await fetchAccountBalance({ address, network, tokenId: token.tokenId })
			return [
				token.tokenId ?? "MINA",
				{ balance: total / token.decimal, symbol: token.symbol }
			] as const
		})
	)

	return { [network]: Object.fromEntries(entries) }
}

export const fetchBalance = fromCallback<
	WalletEvent,
	FetchBalanceInput & { id: string },
	WalletEmit
>(({ sendBack, input }) => {
	const { id, ...params } = input
	const fetchBalance = async () => {
		try {
			sendBack({ type: "FetchBalanceSuccess", id, balances: await fetchBalanceLogic(params) })
		} catch (error) {
			logger.error("fetchBalance error:", error)
			sendBack({ type: "FetchBalanceFailure", id })
		}
	}
	fetchBalance()
	return () => {}
})
