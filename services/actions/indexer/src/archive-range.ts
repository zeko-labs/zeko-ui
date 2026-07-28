interface ArchiveActionWithHeight {
	blockInfo?: { height?: number | null } | null
}

export function filterArchiveActionsToRange<T extends ArchiveActionWithHeight>(
	actions: readonly (T | null | undefined)[],
	from: number,
	to: number
): T[] {
	return actions.filter((action): action is T => {
		const height = action?.blockInfo?.height
		return typeof height === "number" && Number.isFinite(height) && height >= from && height < to
	})
}
