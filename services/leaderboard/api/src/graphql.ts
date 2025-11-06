import { builder } from "./builder"

export * from "./schema/leaderboard"
export * from "./schema/subscription"

export const schema = builder.toSchema({})
