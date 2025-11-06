import { leaderboard as graphql } from "."

export const leaderboardQuery = graphql(`
  query FetchLeaderboard($input: LeaderboardInput) {
    leaderboard(input: $input) {
      entries {
        rank
        wallet
        score
      }
      hasMore
      total
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
