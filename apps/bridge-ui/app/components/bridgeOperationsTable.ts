import type { ColumnDef } from "@tanstack/vue-table"
import type { BridgeNetwork } from "~~/machines/networks"

export type BridgeOperationRow = {
	id: string
	status: unknown
	statusText: string
	statusKind: "complete" | "cancelled" | "pending" | "error"
	source: BridgeNetwork
	destination: BridgeNetwork
	amount: number | string
	hash: string
	timestampMs: number | null
	dateLabel: string
}

export const bridgeOperationDateColumn = {
	id: "date",
	accessorFn: (row: BridgeOperationRow) => row.dateLabel,
	header: "Date"
} satisfies ColumnDef<BridgeOperationRow>

export const bridgeOperationColumns = [
	{ accessorKey: "statusText", header: "Status" },
	{ accessorKey: "source", header: "From" },
	{ accessorKey: "destination", header: "To" },
	{ accessorKey: "amount", header: "Amount" },
	bridgeOperationDateColumn
] satisfies ColumnDef<BridgeOperationRow>[]
