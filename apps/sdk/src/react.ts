import { useActor } from "@xstate/react"
import { Client, type ClientOptions, Provider, fetchExchange } from "urql"
import type {
	Actor,
	ActorOptions,
	ConditionalRequired,
	EventFromLogic,
	IsNotNever,
	RequiredActorOptionsKeys,
	SnapshotFrom
} from "xstate"
import { getRetryExchange } from "./graphql/helpers"
import { createWalletMachine } from "./machines/wallet"

export * from "@xstate/react"

/**
 * GraphQL client
 *___________________________________________________________*/

const clientCache = new Map<string, Client>()

export const createClientOptions = (url: string) =>
	({
		url,
		requestPolicy: "network-only",
		exchanges: [getRetryExchange(), fetchExchange]
	}) as ClientOptions

export const createMinaClient = (url: string) => {
	const cached = clientCache.get(url)
	if (cached) return cached
	const client = new Client(createClientOptions(url))
	clientCache.set(url, client)
	return client
}

export { Provider }

/**
 * Wallet
 *___________________________________________________________*/

const walletMachine = createWalletMachine({ createMinaClient })

type WalletMachine = typeof walletMachine

export function useWallet(
	...[options]: ConditionalRequired<
		[
			options?: ActorOptions<WalletMachine> & {
				[K in RequiredActorOptionsKeys<WalletMachine>]: unknown
			}
		],
		IsNotNever<RequiredActorOptionsKeys<WalletMachine>>
	>
): [
	SnapshotFrom<WalletMachine>,
	(event: EventFromLogic<WalletMachine>) => void,
	Actor<WalletMachine>
] {
	return useActor(walletMachine, options)
}

export { walletMachine }
