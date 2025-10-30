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

const PAGE_SIZE = 50

type DatabaseInstance = ReturnType<Database>

export async function queryLeaderboard(
	db: DatabaseInstance,
	options: {
		searchWallet?: string
		cursorScore?: number
		cursorWallet?: string
		limit: number
	}
) {
	const { searchWallet, cursorScore, cursorWallet, limit } = options

	if (searchWallet) {
		// For search: Single query with window functions and subquery to center around target
		const rankedCTE = db.drizzle.$with("ranked").as(
			db.drizzle
				.select({
					wallet: leaderboard.wallet,
					score: leaderboard.score,
					rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${leaderboard.score} DESC, ${leaderboard.wallet} ASC)::int`.as(
						"rank"
					)
				})
				.from(leaderboard)
				.where(sql`${leaderboard.score} > 0`)
		)

		// Single query: find target rank and fetch centered window
		const result = await db.drizzle
			.with(rankedCTE)
			.select({
				wallet: rankedCTE.wallet,
				score: rankedCTE.score,
				rank: rankedCTE.rank,
				total: sql<number>`COUNT(*) OVER ()::int`.as("total"),
				// Find the target's rank using window function (calculated once across all rows)
				targetRank:
					sql<number>`MAX(CASE WHEN ${rankedCTE.wallet} = ${searchWallet} THEN ${rankedCTE.rank} END) OVER ()::int`.as(
						"target_rank"
					)
			})
			.from(rankedCTE)
			.where(
				// Center the window around target rank (using scalar subquery)
				sql`${rankedCTE.rank} >= GREATEST(1, 
					(SELECT rank FROM ${rankedCTE} WHERE wallet = ${searchWallet}) - ${Math.floor(limit / 2)}
				)`
			)
			.orderBy(rankedCTE.rank)
			.limit(limit + 1)

		if (result.length === 0 || result[0].targetRank === null) {
			return { entries: [], hasMore: false, total: result[0]?.total ?? 0 }
		}

		const hasMore = result.length > limit
		const entries = result
			.slice(0, limit)
			.map(({ wallet, score, rank }) => ({ wallet, score, rank }))

		return { entries, hasMore, total: result[0].total }
	}

	// For pagination: Single CTE with true keyset cursor
	const rankedCTE = db.drizzle.$with("ranked").as(
		db.drizzle
			.select({
				wallet: leaderboard.wallet,
				score: leaderboard.score,
				rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${leaderboard.score} DESC, ${leaderboard.wallet} ASC)::int`.as(
					"rank"
				)
			})
			.from(leaderboard)
			.where(sql`${leaderboard.score} > 0`)
	)

	const result = await db.drizzle
		.with(rankedCTE)
		.select({
			wallet: rankedCTE.wallet,
			score: rankedCTE.score,
			rank: rankedCTE.rank,
			total: sql<number>`COUNT(*) OVER ()::int`.as("total")
		})
		.from(rankedCTE)
		.where(
			cursorScore !== undefined && cursorWallet
				? // True keyset pagination: compare composite key for DESC score, ASC wallet ordering
					// For next page: score < cursorScore OR (score = cursorScore AND wallet > cursorWallet)
					sql`(${rankedCTE.score} < ${cursorScore}) OR (${rankedCTE.score} = ${cursorScore} AND ${rankedCTE.wallet} > ${cursorWallet})`
				: sql`1=1`
		)
		.orderBy(sql`${rankedCTE.score} DESC`, sql`${rankedCTE.wallet} ASC`)
		.limit(limit + 1)

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
		rank: t.exposeInt("rank"),
		wallet: t.exposeString("wallet"),
		score: t.exposeInt("score")
	})
})

const LeaderboardResultObject = builder
	.objectRef<LeaderboardResult>("LeaderboardResult")
	.implement({
		fields: (t) => ({
			entries: t.field({ type: [LeaderboardEntryObject], resolve: (r) => r.entries }),
			hasMore: t.exposeBoolean("hasMore"),
			total: t.exposeInt("total")
		})
	})

const LeaderboardInput = builder.inputType("LeaderboardInput", {
	fields: (t) => ({
		cursorScore: t.int({ required: false }),
		cursorWallet: t.string({ required: false }),
		searchWallet: t.string({ required: false })
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
					cursorScore: input?.cursorScore ?? undefined,
					cursorWallet: input?.cursorWallet ?? undefined,
					limit: PAGE_SIZE
				})

				return result
			}
		})
	})
})
