import { leaderboard as graphql } from "./clients"

export const leaderboardQuery = graphql(`
  query FetchLeaderboard($input: LeaderboardInput) {
    leaderboard(input: $input) {
      entries {
        rank
        wallet
        score
      }
      hasMore
      totalEntries
      totalPoints
    }
  }
`)

export const leaderboardUpdateSubscription = graphql(`
  subscription LeaderboardUpdate {
    onNewTransaction {
      maxBlockHeight
      hasNewEntries
      timestamp
    }
  }
`)
