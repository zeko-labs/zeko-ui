import type { ColumnDef } from "@tanstack/vue-table"
import type { BridgeOperationCompletionVerification } from "~~/machines/bridgeOperation"
import type { BridgeNetwork } from "~~/machines/networks"
import { formatOperationDate } from "~~/machines/operationTimestamps"
import type { PendingBridgeTransaction } from "~~/machines/pendingTransactions"

export type BridgeOperationStatusKind = "complete" | "cancelled" | "pending" | "error"

export type BridgeOperationDisplayStatus = {
	text: string
	kind: BridgeOperationStatusKind
}

export type BridgeOperationRow = {
	id: string
	status: unknown
	statusText: string
	statusKind: BridgeOperationStatusKind
	source: BridgeNetwork
	destination: BridgeNetwork
	amount: number | string
	hash: string
	timestampMs: number | null
	dateLabel: string
}

export const completedOperationTableStatus = (
	status: BridgeOperationDisplayStatus,
	completionVerification: BridgeOperationCompletionVerification
): BridgeOperationDisplayStatus => {
	if (
		(status.kind === "complete" || status.kind === "cancelled") &&
		completionVerification === "unverified"
	)
		return { text: "Finalizing", kind: "pending" }
	if (status.kind === "complete") return { text: "Completed", kind: "complete" }
	return status
}

const pendingBridgeTransactionStatusText = (status: PendingBridgeTransaction["status"]) => {
	if (status === "finalizing") return "Finalizing"
	if (status === "awaiting-claim") return "Awaiting claim"
	return "Awaiting inclusion"
}

export const pendingBridgeTransactionRows = (
	transactions: readonly PendingBridgeTransaction[]
): BridgeOperationRow[] =>
	transactions.map((transaction) => ({
		id: `pending-${transaction.transactionHash}`,
		status: transaction.status,
		statusText: pendingBridgeTransactionStatusText(transaction.status),
		statusKind: "pending",
		source: transaction.source,
		destination: transaction.destination,
		amount: transaction.amount,
		hash: transaction.transactionHash,
		timestampMs: transaction.submittedAtMs,
		dateLabel: formatOperationDate(transaction.submittedAtMs)
	}))

export const mergeBridgeOperationRows = (
	fetchedRows: readonly BridgeOperationRow[],
	pendingRows: readonly BridgeOperationRow[]
): BridgeOperationRow[] => {
	const fetchedHashes = new Set(fetchedRows.map(({ hash }) => hash).filter(Boolean))
	return [...fetchedRows, ...pendingRows.filter(({ hash }) => !fetchedHashes.has(hash))]
}

export const bridgeOperationDateColumn = {
	id: "date",
	accessorFn: (row: BridgeOperationRow) => row.dateLabel,
	header: "Date"
} satisfies ColumnDef<BridgeOperationRow>

export const bridgeOperationHashColumn = {
	id: "hash",
	accessorFn: (row: BridgeOperationRow) => row.hash,
	header: "Hash"
} satisfies ColumnDef<BridgeOperationRow>

export const bridgeOperationColumns = [
	{ accessorKey: "statusText", header: "Status" },
	{ accessorKey: "source", header: "From" },
	{ accessorKey: "destination", header: "To" },
	{ accessorKey: "amount", header: "Amount" },
	bridgeOperationHashColumn,
	bridgeOperationDateColumn
] satisfies ColumnDef<BridgeOperationRow>[]
