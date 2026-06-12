export const indexerControlCopy = {
	rebuild: {
		label: "Rebuild",
		description:
			"Rebuild repopulates indexed rows from archive sources and resumes from the rebuilt heads.",
		whenToUse:
			"Use it when archive data is trusted but indexed rows are incomplete, stale, or wrong."
	},
	reset: {
		label: "Reset",
		description: "Reset clears indexed state and starts from scratch.",
		whenToUse: "Use it when the stored indexer state, cursors, or derived data cannot be trusted."
	},
	note: "Rebuild repopulates indexed rows from archive sources and resumes from the rebuilt heads. Reset clears indexed state and starts from scratch. Both exist so you can repair bad/missing indexed rows without discarding trusted cursors, or fully restart when the stored indexer state cannot be trusted."
} as const
