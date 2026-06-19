import { createConsola } from "consola"

export const logger = createConsola().withTag("ACTIONS_API")

export const checkDatabaseConnectionString = (P = process) => {
	const args = P.argv.slice(2)
	const connectionString = P.env.DATABASE_URL
	if (!connectionString) {
		console.error("DATABASE_URL is not set. Aborting...")
		P.exit(1)
		throw null
	}
	if (connectionString.includes("supabase")) {
		if (args.includes("--force")) {
			console.log(
				"/!\\ You are connected to a Supabase url ! Be very careful, this could be live data ! /!\\"
			)
			return connectionString
		}
		console.error(
			"Running dangerous commands against a Supabase URL requires the --force flag. Aborting..."
		)
		P.exit(1)
		throw null
	}
	return connectionString
}

export const GENESIS_BEFORE_STATE =
	"25079927036070901246064867767436987657692091363973573142121686150614948079097"
