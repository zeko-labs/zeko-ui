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

type DatabaseInstance = ReturnType<Database>

export async function queryLeaderboard(
	db: DatabaseInstance,
	options: {
		searchWallet?: string
		page?: number
		limit: number
	}
) {
	const { searchWallet, page = 1, limit } = options
	const offset = (page - 1) * limit

	// CTE with rank calculation and total count
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

	// Build WHERE clause based on search
	const whereClause = searchWallet
		? sql`${rankedCTE.score} <= (SELECT score FROM ${rankedCTE} WHERE wallet = ${searchWallet})`
		: sql`1=1`

	// Query for pagination
	const result = await db.drizzle
		.with(rankedCTE)
		.select({
			wallet: rankedCTE.wallet,
			score: rankedCTE.score,
			rank: rankedCTE.rank,
			total: rankedCTE.total
		})
		.from(rankedCTE)
		.where(whereClause)
		.orderBy(sql`${rankedCTE.score} DESC`, sql`${rankedCTE.wallet} ASC`)
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
		page: t.int({ required: false }),
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
					page: input?.page ?? undefined,
					limit: input?.pageSize ?? PAGE_SIZE
				})

				return result
			}
		})
	})
})
