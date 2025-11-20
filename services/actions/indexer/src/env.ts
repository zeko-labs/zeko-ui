import * as v from "valibot"

const Schema = v.object({
	DATABASE_URL: v.string(),
	AUTH_TOKEN: v.string(),
	PORT: v.optional(v.string()),
	L1_ARCHIVE_URL: v.string(),
	L1_FINALITY: v.optional(v.number())
})
export const env = v.parse(Schema, process.env)
