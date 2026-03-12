export type AeErrorRow = {
	category: string
	action: string
	label: string
	occurrences: number
}

export type AeErrorAuditRow = AeErrorRow & {
	labelSummary: string
	codePath: string
	currentHandling: string
	expectedSentryBehavior: "should-capture" | "should-not-capture" | "needs-repro"
	currentBehavior: "correct" | "incorrect" | "partially-correct" | "needs-audit"
	reason: string
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim()

export const summarizeAuditLabel = (label: string): string =>
	normalizeWhitespace(label).replace(/\b\d{20,}\b/g, "<bigint>")

const buildActHandling = (action: string) =>
	`createLogger.act("${action}") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.`

const buildSyntheticHandling =
	"Bridge operation FAILED emits a synthetic analytics metric row only; it is a rollup event rather than the root exception path."

const codePathFor = ({ category, action }: AeErrorRow): string => {
	if (category === "bridge" && action === "findPendingOperation") {
		return 'machines/bridge.ts -> actors.findPendingOperations -> act("findPendingOperation")'
	}

	if (category === "bridge_operation" && action === "submitDeposit") {
		return 'machines/bridgeOperation.ts -> actors.submitDeposit -> act("submitDeposit")'
	}

	if (category === "bridge_operation" && action === "finalizeWithdrawal") {
		return 'machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")'
	}

	if (category === "transaction" && action === "sendSignedTransaction") {
		return 'machines/transaction.ts -> actors.sendSignedTransaction -> act("sendSignedTransaction")'
	}

	if (category === "transaction" && action === "signTransaction") {
		return 'machines/transaction.ts -> actors.signTransaction -> act("signTransaction")'
	}

	if (category === "bridge_operation" && action === "failed") {
		return 'machines/bridgeOperation.ts -> FAILED entry -> sendMetric({ category: "bridge_operation", action: "failed" })'
	}

	return `${category}/${action}`
}

const classify = (row: AeErrorRow): Omit<AeErrorAuditRow, keyof AeErrorRow | "labelSummary"> => {
	if (row.category === "bridge" && row.action === "findPendingOperation") {
		return {
			codePath: codePathFor(row),
			currentHandling: buildActHandling(row.action),
			expectedSentryBehavior: "should-capture",
			currentBehavior: "correct",
			reason:
				"Backend proof data failures are real bridge exceptions. They should appear in Sentry with bridge/action context, and the current instrumentation now captures them explicitly before the machine handles the rethrow."
		}
	}

	if (row.category === "bridge_operation" && row.action === "finalizeWithdrawal") {
		return {
			codePath: codePathFor(row),
			currentHandling: buildActHandling(row.action),
			expectedSentryBehavior: "should-capture",
			currentBehavior: "correct",
			reason:
				"Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry."
		}
	}

	if (row.category === "bridge_operation" && row.action === "submitDeposit") {
		return {
			codePath: codePathFor(row),
			currentHandling: buildActHandling(row.action),
			expectedSentryBehavior: "should-capture",
			currentBehavior: "correct",
			reason:
				"Submit deposit transaction failures are root bridge-operation exceptions and the current code now captures them explicitly in Sentry."
		}
	}

	if (row.category === "transaction" && row.action === "sendSignedTransaction") {
		return {
			codePath: codePathFor(row),
			currentHandling: buildActHandling(row.action),
			expectedSentryBehavior: "should-capture",
			currentBehavior: "correct",
			reason:
				"Broadcast failures are root transaction exceptions. The current code captures both nonce-precondition and unknown transport failures as grouped Sentry issues."
		}
	}

	if (row.category === "transaction" && row.action === "signTransaction") {
		return {
			codePath: codePathFor(row),
			currentHandling: buildActHandling(row.action),
			expectedSentryBehavior: "should-capture",
			currentBehavior: "correct",
			reason:
				"Non-Error object failures should preserve structured details so the normal Sentry filters and grouping rules can evaluate the real error. The current code now serializes those objects instead of collapsing them to `[object Object]`."
		}
	}

	if (row.category === "bridge_operation" && row.action === "failed") {
		return {
			codePath: codePathFor(row),
			currentHandling: buildSyntheticHandling,
			expectedSentryBehavior: "should-not-capture",
			currentBehavior: "correct",
			reason:
				"This is a synthetic lifecycle rollup. It should not create its own top-level Sentry issue; the underlying root action error should be captured instead."
		}
	}

	return {
		codePath: codePathFor(row),
		currentHandling: "No explicit classification rule yet.",
		expectedSentryBehavior: "needs-repro",
		currentBehavior: "needs-audit",
		reason: "This tuple needs a dedicated audit rule before Sentry expectations can be locked."
	}
}

export const classifyAeErrorRow = (row: AeErrorRow): AeErrorAuditRow => ({
	...row,
	labelSummary: summarizeAuditLabel(row.label),
	...classify(row)
})
