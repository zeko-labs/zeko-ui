import * as v from "valibot"

const Schema = v.object({
	DATABASE_URL: v.string(),
	AUTH_TOKEN: v.string(),
	PORT: v.optional(v.string())
})
export const env = v.parse(Schema, process.env)
