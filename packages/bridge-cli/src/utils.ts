export const formatErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

export const sleepFor = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms))
