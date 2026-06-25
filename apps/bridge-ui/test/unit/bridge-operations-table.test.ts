import { describe, expect, it } from "vitest"
import bridgeOperationsSource from "../../app/components/BridgeOperations.vue?raw"
import {
	completedOperationTableStatus,
	bridgeOperationDateColumn,
	bridgeOperationHashColumn,
	bridgeOperationColumns,
	type BridgeOperationRow
} from "../../app/utils/bridgeOperationsTable"

describe("bridgeOperationDateColumn", () => {
	it("reads the rendered date from dateLabel", () => {
		const row: BridgeOperationRow = {
			id: "op-1",
			status: "DONE",
			statusText: "Completed",
			statusKind: "complete",
			source: "zeko",
			destination: "mina",
			amount: 1,
			hash: "0x123",
			timestampMs: 1700000000000,
			dateLabel: "11/14/2023"
		}

		expect(bridgeOperationDateColumn.id).toBe("date")
		expect(bridgeOperationDateColumn.accessorFn?.(row, 0)).toBe("11/14/2023")
	})

	it("exposes completed transaction hashes as a rendered table column", () => {
		const row: BridgeOperationRow = {
			id: "op-1",
			status: "DONE",
			statusText: "Completed",
			statusKind: "complete",
			source: "zeko",
			destination: "mina",
			amount: 1,
			hash: "5Jdebug000001",
			timestampMs: 1700000000000,
			dateLabel: "11/14/2023"
		}

		expect(bridgeOperationColumns.map((column) => column.header)).toContain("Hash")
		expect(bridgeOperationHashColumn.accessorFn?.(row, 0)).toBe("5Jdebug000001")
		expect(bridgeOperationsSource).toContain('row.getValue("hash")')
	})

	it("renders pending status text for unverified completed rows", () => {
		const row: BridgeOperationRow = {
			id: "op-1",
			status: "BRIDGE_OPERATION_COMPLETED",
			statusText: "Pending",
			statusKind: "pending",
			source: "zeko",
			destination: "mina",
			amount: 1,
			hash: "5Jdebug000001",
			timestampMs: 1700000000000,
			dateLabel: "11/14/2023"
		}

		expect(row.statusKind).toBe("pending")
		expect(row.statusText).toBe("Pending")
		expect(bridgeOperationsSource).toContain("row.original.statusText")
	})

	it("keeps verified completed table labels compact", () => {
		expect(
			completedOperationTableStatus({ text: "Deposit Completed", kind: "complete" }, "verified")
		).toEqual({ text: "Completed", kind: "complete" })
		expect(
			completedOperationTableStatus(
				{ text: "Withdrawal Completed", kind: "complete" },
				"unverified"
			)
		).toEqual({ text: "Pending", kind: "pending" })
	})

	it("shows unverified cancelled rows as pending until backend cancellation recovery matches", () => {
		expect(
			completedOperationTableStatus({ text: "Cancelled", kind: "cancelled" }, "unverified")
		).toEqual({
			text: "Pending",
			kind: "pending"
		})
		expect(
			completedOperationTableStatus({ text: "Cancelled", kind: "cancelled" }, "verified")
		).toEqual({
			text: "Cancelled",
			kind: "cancelled"
		})
	})
})
