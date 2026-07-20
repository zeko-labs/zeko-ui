const DIGITS_ONLY = /^\d+$/

export const normalizeOperationTimestamp = (value: unknown): number | null => {
	if (value instanceof Date) {
		const timestampMs = value.getTime()
		return Number.isFinite(timestampMs) ? timestampMs : null
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null
	}

	if (typeof value !== "string") {
		return null
	}

	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return null
	}

	const timestampMs = DIGITS_ONLY.test(trimmed) ? Number(trimmed) : Date.parse(trimmed)

	return Number.isFinite(timestampMs) ? timestampMs : null
}

export const sortOperationTimestampsDesc = (left: number | null, right: number | null): number => {
	if (left == null && right == null) return 0
	if (left == null) return 1
	if (right == null) return -1
	return right - left
}

export const formatOperationDate = (
	timestampMs: number | null,
	locale?: string | string[]
): string => {
	if (timestampMs == null) {
		return "Unknown"
	}

	return new Date(timestampMs).toLocaleString(locale, {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	})
}
