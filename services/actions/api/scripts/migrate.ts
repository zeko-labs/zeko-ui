import { $ } from "bun"
import { checkDatabaseConnectionString } from "../src/helpers/utils"

const main = async () => {
	try {
		checkDatabaseConnectionString()
		const stdout = await $`drizzle-kit migrate`
		console.log(`\n db:migrate:apply exited with code ${stdout.exitCode}`)
	} catch (e) {
		console.error("Error during migration:", e)
		return
	}
}

await main()
