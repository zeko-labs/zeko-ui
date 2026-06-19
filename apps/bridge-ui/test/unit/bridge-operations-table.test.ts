import { describe, expect, it } from "vitest"
import bridgeOperationsSource from "../../app/components/BridgeOperations.vue?raw"
import {
	bridgeOperationDateColumn,
	bridgeOperationHashColumn,
	bridgeOperationColumns,
	type BridgeOperationRow
} from "../../app/components/bridgeOperationsTable"

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
})
