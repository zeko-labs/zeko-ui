export const readString = (args: Record<string, unknown>, name: string): string | undefined =>
	typeof args[name] === "string" && args[name].length > 0 ? args[name] : undefined

export const readRequired = (
	args: Record<string, unknown>,
	name: string,
	message = `Missing required ${name}`
): string => {
	const value = readString(args, name)
	if (!value) throw new Error(message)
	return value
}

export const readBoolean = (
	args: Record<string, unknown>,
	name: string,
	fallback = false
): boolean => (typeof args[name] === "boolean" ? args[name] : fallback)

export const readAliasedString = (args: Record<string, unknown>, name: string, alias: string) =>
	readString(args, name) ?? readString(args, alias)

export const readNumber = (
	args: Record<string, unknown>,
	name: string,
	flag: string
): number | undefined => {
	const value = readString(args, name)
	if (value === undefined) return undefined
	const parsed = Number(value)
	if (!Number.isFinite(parsed) || parsed < 0)
		throw new Error(`${flag} must be a non-negative number`)
	return parsed
}

export const readAliasedNumber = (
	args: Record<string, unknown>,
	name: string,
	alias: string,
	flag: string
): number | undefined =>
	readString(args, name) ? readNumber(args, name, flag) : readNumber(args, alias, flag)
