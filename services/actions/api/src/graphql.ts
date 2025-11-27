export * from "./schema/inner"
export * from "./schema/outer"

import { builder } from "./builder"

export const schema = builder.toSchema({})
