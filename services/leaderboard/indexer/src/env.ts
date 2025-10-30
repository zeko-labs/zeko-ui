import * as v from "valibot"

const Schema = v.object({
	DATABASE_URL: v.string(),
	AUTH_TOKEN: v.string(),
	BROADCAST_URL: v.string()
})
export const env = v.parse(Schema, process.env)
