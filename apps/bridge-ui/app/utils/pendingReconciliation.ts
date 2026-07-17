import type { BridgeOperationCompletionVerification } from "~~/machines/bridgeOperation"

export const completedOperationReconciliationHash = ({
	hash,
	completionVerification
}: {
	hash: string | null
	completionVerification: BridgeOperationCompletionVerification
}): string | null => (completionVerification === "verified" ? hash : null)
