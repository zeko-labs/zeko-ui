export * from "./schema/inner"
export * from "./schema/outer"
export * from "./schema/registry"

import { builder } from "./builder"

export const schema = builder.toSchema({})
