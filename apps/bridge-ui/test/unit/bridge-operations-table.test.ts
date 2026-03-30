import { describe, expect, it } from "vitest"
import {
	bridgeOperationDateColumn,
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
})
