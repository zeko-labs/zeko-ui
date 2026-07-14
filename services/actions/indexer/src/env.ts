import * as v from "valibot"

const Schema = v.object({
	DATABASE_URL: v.string(),
	AUTH_TOKEN: v.string(),
	PORT: v.optional(v.string()),
	L1_ARCHIVE_URL: v.string(),
	L1_FINALITY: v.pipe(v.fallback(v.string(), "290"), v.transform(Number)),
	L2_ARCHIVE_URL: v.string(),
	L2_FINALITY_TIME_H: v.pipe(v.fallback(v.string(), "72"), v.transform(Number)),
	OUTER_PK: v.string(),
	INNER_PK: v.string(),
	INDEX_OUTER: v.pipe(
		v.fallback(v.string(), "true"),
		v.transform((value) => !["0", "false", "no", "off"].includes(value.toLowerCase()))
	),
	INDEX_INNER: v.pipe(
		v.fallback(v.string(), "true"),
		v.transform((value) => !["0", "false", "no", "off"].includes(value.toLowerCase()))
	),
	ENVIRONMENT: v.optional(v.string())
})
export const env = v.parse(Schema, process.env)
