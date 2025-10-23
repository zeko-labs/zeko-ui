/**
 * Scoring logic for leaderboard
 * This file contains the business rules for calculating points
 */

export const POINT_VALUES = {
	FAUCET_ZEKO_TMINA: { points: 10, maxOccurrences: 1 },
	BRIDGE_MINA_TO_ZEKO: { points: 20, maxOccurrences: 1 },
	BRIDGE_ZEKO_TO_MINA: { points: 20, maxOccurrences: 1 },
	LUMINA_SWAP_MINA_TZEKO: { points: 5, maxOccurrences: 20 },
	LUMINA_ADD_LIQUIDITY_MINA_TZEKO: { points: 10, maxOccurrences: 5 }
} as const

export type ActionType = keyof typeof POINT_VALUES

/**
 * Calculate the score for a wallet based on their actions
 * @param actions Map of action type to count of occurrences
 * @param manualAdjustment Optional manual adjustment to add/subtract
 * @returns Total score
 */
export function calculateScore(
	actions: Partial<Record<ActionType, number>>,
	manualAdjustment = 0
): number {
	let score = 0

	for (const [actionType, count] of Object.entries(actions) as Array<[ActionType, number]>) {
		const config = POINT_VALUES[actionType]
		const cappedCount = Math.min(count, config.maxOccurrences)
		score += cappedCount * config.points
	}

	return score + manualAdjustment
}
