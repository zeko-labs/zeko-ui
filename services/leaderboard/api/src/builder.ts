import SchemaBuilder from "@pothos/core"
import type { Database } from "./db"

export type Context = {
	env: Env
	cloudflareContext: ExecutionContext
	database: Database
}

type Pothos = { Context: Context }

export const builder = new SchemaBuilder<Pothos>({})
