import type { ColumnDef } from "@tanstack/vue-table"
import type { BridgeOperationCompletionVerification } from "~~/machines/bridgeOperation"
import type { BridgeNetwork } from "~~/machines/networks"

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
		return { text: "Unindexed", kind: "pending" }
	if (status.kind === "complete") return { text: "Completed", kind: "complete" }
	return status
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
