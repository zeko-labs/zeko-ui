import { sql } from "drizzle-orm"
import { leaderboard } from "../../drizzle/schema"
import { builder } from "../builder"
import type { Database } from "../db"

interface LeaderboardEntry {
	rank: number
	wallet: string
	score: number
}

interface LeaderboardResult {
	entries: LeaderboardEntry[]
	hasMore: boolean
	total: number
}

const PAGE_SIZE = 20
const DEFAULT_PAGE = 1

type DatabaseInstance = ReturnType<Database>

/**
 * Performance considerations:
 *
 * 1. ROW_NUMBER() is required to calculate ranks for display.
 * 2. Once we use ROW_NUMBER(), we must scan the entire qualifying dataset.
 * 3. COUNT(*) OVER() is computed in the SAME window pass as ROW_NUMBER(),
 *    adding negligible overhead since the window operation cost is already incurred.
 * 4. When searching, we filter by rank >= searched_wallet_rank, which is efficient
 *    because ranks are already computed in the CTE.
 * 5. OFFSET on the filtered CTE is efficient because it operates on the already-computed,
 *    ranked result set in memory, not on the raw table.
 * 6. The (score DESC, wallet ASC) index supports both the window function ordering
 *    and ensures deterministic ranking when scores are tied.
 *
 * Alternative approaches considered:
 * - Keyset pagination: Would still require ROW_NUMBER() for ranks, making it more
 *   complex without performance benefit. Also doesn't support arbitrary page access.
 * - Separate COUNT(*): Would require an additional table scan, which is slower
 *   than computing COUNT(*) OVER() in the same window pass.
 */
export async function queryLeaderboard(
	db: DatabaseInstance,
	options: {
		searchWallet?: string
		page?: number
		limit: number
	}
) {
	const { searchWallet, limit } = options
	const page = options.page ?? DEFAULT_PAGE
	const offset = (page - 1) * limit

	const rankedCTE = db.drizzle.$with("ranked").as(
		db.drizzle
			.select({
				wallet: leaderboard.wallet,
				score: leaderboard.score,
				rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${leaderboard.score} DESC, ${leaderboard.wallet} ASC)::int`.as(
					"rank"
				),
				total: sql<number>`COUNT(*) OVER ()::int`.as("total")
			})
			.from(leaderboard)
			.where(sql`${leaderboard.score} > 0`)
	)

	const whereClause = searchWallet
		? sql`${rankedCTE.rank} >= (SELECT rank FROM ${rankedCTE} WHERE wallet = ${searchWallet})`
		: sql`1=1`

	const { wallet, score, rank, total } = rankedCTE
	const result = await db.drizzle
		.with(rankedCTE)
		.select({ wallet, score, rank, total })
		.from(rankedCTE)
		.where(whereClause)
		.orderBy(sql`${rankedCTE.rank} ASC`)
		.limit(limit + 1)
		.offset(offset)

	if (result.length === 0) return { entries: [], hasMore: false, total: 0 }

	const hasMore = result.length > limit
	const entries = result.slice(0, limit).map(({ wallet, score, rank }) => ({ wallet, score, rank }))

	return { entries, hasMore, total: result[0].total }
}

/**
 * GraphQL Schema
 */
const LeaderboardEntryObject = builder.objectRef<LeaderboardEntry>("LeaderboardEntry").implement({
	fields: (t) => ({
		rank: t.exposeInt("rank", { nullable: false }),
		wallet: t.exposeString("wallet", { nullable: false }),
		score: t.exposeInt("score", { nullable: false })
	})
})

const LeaderboardResultObject = builder
	.objectRef<LeaderboardResult>("LeaderboardResult")
	.implement({
		fields: (t) => ({
			entries: t.field({
				type: [LeaderboardEntryObject],
				resolve: (r) => r.entries,
				nullable: false
			}),
			hasMore: t.exposeBoolean("hasMore", { nullable: false }),
			total: t.exposeInt("total", { nullable: false })
		})
	})

const LeaderboardInput = builder.inputType("LeaderboardInput", {
	fields: (t) => ({
		page: t.int({ required: false, defaultValue: DEFAULT_PAGE }),
		searchWallet: t.string({ required: false }),
		pageSize: t.int({ required: false, defaultValue: PAGE_SIZE })
	})
})

builder.queryType({
	fields: (t) => ({
		leaderboard: t.field({
			type: LeaderboardResultObject,
			args: { input: t.arg({ type: LeaderboardInput, required: false }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: false })

				const result = await queryLeaderboard(db, {
					searchWallet: input?.searchWallet ?? undefined,
					page: input?.page ?? DEFAULT_PAGE,
					limit: input?.pageSize ?? PAGE_SIZE
				})

				return result
			}
		})
	})
})
