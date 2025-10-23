import SchemaBuilder from "@pothos/core"
import type { Database } from "./db"

export interface Context {
	env: Env
	cloudflareContext: ExecutionContext
	database: Database
}

interface Pothos {
	Context: Context
}

export const builder = new SchemaBuilder<Pothos>({})
