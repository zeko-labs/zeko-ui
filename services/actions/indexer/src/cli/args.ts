const pickArg = (args: Record<string, unknown>, keys: string[]): unknown => {
	for (const key of keys) {
		const value = args[key]
		if (value !== undefined) return value
	}
	return undefined
}

const asNumber = (value: unknown, fallback: number): number => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

export const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined

export const readCliNumberArg = (
	args: Record<string, unknown>,
	keys: string[],
	fallback: number
): number => asNumber(pickArg(args, keys), fallback)

export const readCliBooleanArg = (
	args: Record<string, unknown>,
	keys: string[],
	fallback: boolean
): boolean => {
	const raw = pickArg(args, keys)
	if (raw == null) return fallback
	if (typeof raw === "boolean") return raw
	if (typeof raw === "string") {
		if (raw === "true" || raw === "1") return true
		if (raw === "false" || raw === "0") return false
	}
	return fallback
}
