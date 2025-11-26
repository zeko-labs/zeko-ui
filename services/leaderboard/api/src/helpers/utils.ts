import type { Client } from "@urql/core"
import { networkStateQuery } from "@zeko/graphql/mina-archive"
import { FetchZekoArchiveEvents } from "@zeko/graphql/zeko-archive"
import { createConsola } from "consola"

export const logger = createConsola().withTag("LEADERBOARD_API")

export const checkDatabaseConnectionString = (P = process) => {
	const args = P.argv.slice(2)
	const connectionString = P.env.DATABASE_URL
	if (!connectionString) {
		console.error("DATABASE_URL is not set. Aborting...")
		P.exit(1)
		throw null
	}
	if (connectionString.includes("supabase")) {
		if (args.includes("--force")) {
			console.log(
				"/!\\ You are connected to a Supabase url ! Be very careful, this could be live data ! /!\\"
			)
			return connectionString
		}
		console.error(
			"Running dangerous commands against a Supabase URL requires the --force flag. Aborting..."
		)
		P.exit(1)
		throw null
	}
	return connectionString
}

export async function fetchEventsRaw({
	address,
	from,
	to,
	canonical = true,
	client
}: { address: string; canonical?: boolean; from?: number; to?: number; client: Client }) {
	const input = {
		address,
		...(canonical && { status: "CANONICAL" as const }),
		...(from !== undefined && { from }),
		...(to !== undefined && { to })
	}

	const { data, error } = await client.query(FetchZekoArchiveEvents, { input })

	if (error) {
		console.error("GraphQL error:", error)
		throw error
	}
	if (!data?.events) throw new Error("No events data returned from archive")

	return data.events
}

export async function getMaxBlockHeightL2(client: Client) {
	const state = await client.query(networkStateQuery, {})
	if (state.error) throw new Error(`Network state query error: ${state.error.message}`)
	if (!state.data?.networkState?.maxBlockHeight?.canonicalMaxBlockHeight)
		throw new Error("No max block height in network state response")
	return state.data.networkState.maxBlockHeight.canonicalMaxBlockHeight
}
