import { describe, expect, it } from "vitest"
import bridgeOperationsSource from "../../app/components/BridgeOperations.vue?raw"
import {
	completedOperationTableStatus,
	bridgeOperationDateColumn,
	bridgeOperationHashColumn,
	bridgeOperationColumns,
	mergeBridgeOperationRows,
	networkTransactionExplorerUrl,
	pendingBridgeTransactionRows,
	transactionExplorerUrl,
	type BridgeOperationRow
} from "../../app/utils/bridgeOperationsTable"
import type { PendingBridgeTransaction } from "../../machines/pendingTransactions"

const pendingRecord = (
	overrides: Partial<PendingBridgeTransaction> = {}
): PendingBridgeTransaction => ({
	schemaVersion: 1,
	walletAddress: "B62qwallet-1",
	l1: "mina:devnet",
	l2: "zeko:testnet",
	source: "mina:devnet",
	destination: "zeko:testnet",
	direction: "deposit",
	amount: "3.25",
	transactionHash: "5JpendingHash",
	submittedAtMs: Date.parse("2026-07-01T00:00:00Z"),
	status: "awaiting-inclusion",
	...overrides
})

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

	it("links transaction hashes to the correct explorer", () => {
		const baseRow: BridgeOperationRow = {
			id: "op-1",
			status: "PENDING",
			statusText: "Awaiting inclusion",
			statusKind: "pending",
			source: "mina:mainnet",
			destination: "zeko-m:mainnet",
			amount: 1,
			hash: "5JmainnetDeposit",
			timestampMs: null,
			dateLabel: "Unknown"
		}

		expect(transactionExplorerUrl(baseRow)).toBe("https://minascan.io/mainnet/tx/5JmainnetDeposit")
		expect(
			transactionExplorerUrl({
				...baseRow,
				source: "zeko-m:mainnet",
				destination: "mina:mainnet",
				hash: "5JmainnetWithdrawal"
			})
		).toBe("https://zekoscan.io/mainnet/tx/5JmainnetWithdrawal")
		expect(
			transactionExplorerUrl({
				...baseRow,
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				hash: "5JtestnetDeposit"
			})
		).toBe("https://minascan.io/devnet/tx/5JtestnetDeposit")
		expect(
			transactionExplorerUrl({
				...baseRow,
				source: "zeko-m:testnet",
				destination: "mina:devnet",
				hash: "5JtestnetWithdrawal"
			})
		).toBe("https://zekoscan.xyz/testnet/tx/5JtestnetWithdrawal")
	})

	it("links finalization hashes by destination network", () => {
		expect(
			networkTransactionExplorerUrl({ network: "zeko-m:mainnet", hash: "5JfinalizeDeposit" })
		).toBe("https://zekoscan.io/mainnet/tx/5JfinalizeDeposit")
		expect(
			networkTransactionExplorerUrl({ network: "mina:mainnet", hash: "5JfinalizeWithdrawal" })
		).toBe("https://minascan.io/mainnet/tx/5JfinalizeWithdrawal")
		expect(
			networkTransactionExplorerUrl({ network: "zeko-m:testnet", hash: "5JtestnetFinalizeDeposit" })
		).toBe("https://zekoscan.xyz/testnet/tx/5JtestnetFinalizeDeposit")
		expect(
			networkTransactionExplorerUrl({ network: "mina:devnet", hash: "5JtestnetFinalizeWithdrawal" })
		).toBe("https://minascan.io/devnet/tx/5JtestnetFinalizeWithdrawal")
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
		expect(bridgeOperationsSource).toContain("row.original.hash")
	})

	it("keeps history rows keyed to the original submit transaction hash", () => {
		expect(bridgeOperationsSource).toContain(
			'hash: submitHash || state.value.context.transaction?.hash || ""'
		)
	})

	it("renders finalizing status text for unverified completed rows", () => {
		const row: BridgeOperationRow = {
			id: "op-1",
			status: "BRIDGE_OPERATION_COMPLETED",
			statusText: "Finalizing",
			statusKind: "pending",
			source: "zeko",
			destination: "mina",
			amount: 1,
			hash: "5Jdebug000001",
			timestampMs: 1700000000000,
			dateLabel: "11/14/2023"
		}

		expect(row.statusKind).toBe("pending")
		expect(row.statusText).toBe("Finalizing")
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
		).toEqual({ text: "Finalizing", kind: "pending" })
	})

	it("shows unverified cancelled rows as pending until backend cancellation recovery matches", () => {
		expect(
			completedOperationTableStatus({ text: "Cancelled", kind: "cancelled" }, "unverified")
		).toEqual({
			text: "Finalizing",
			kind: "pending"
		})
		expect(
			completedOperationTableStatus({ text: "Cancelled", kind: "cancelled" }, "verified")
		).toEqual({
			text: "Cancelled",
			kind: "cancelled"
		})
	})

	it("maps pending-only persisted bridge transactions to awaiting inclusion rows", () => {
		expect(pendingBridgeTransactionRows([pendingRecord()])).toMatchObject([
			{
				id: "pending-5JpendingHash",
				statusText: "Awaiting inclusion",
				statusKind: "pending",
				source: "mina:devnet",
				destination: "zeko:testnet",
				amount: "3.25",
				hash: "5JpendingHash",
				timestampMs: Date.parse("2026-07-01T00:00:00Z")
			}
		])
	})

	it("maps recovered pending bridge transactions to awaiting claim rows", () => {
		expect(
			pendingBridgeTransactionRows([pendingRecord({ status: "awaiting-claim" })])
		).toMatchObject([
			{
				statusText: "Awaiting claim",
				statusKind: "pending",
				hash: "5JpendingHash"
			}
		])
	})

	it("maps claimed pending bridge transactions to finalizing rows", () => {
		expect(pendingBridgeTransactionRows([pendingRecord({ status: "finalizing" })])).toMatchObject([
			{
				statusText: "Finalizing",
				statusKind: "pending",
				hash: "5JpendingHash"
			}
		])
	})

	it("prefers fetched operation rows over duplicate pending rows", () => {
		const fetchedRow: BridgeOperationRow = {
			id: "op-1",
			status: "BRIDGE_OPERATION_COMPLETED",
			statusText: "Completed",
			statusKind: "complete",
			source: "mina:devnet",
			destination: "zeko:testnet",
			amount: "3.25",
			hash: "5JpendingHash",
			timestampMs: Date.parse("2026-07-01T00:30:00Z"),
			dateLabel: "Jul 1, 2026"
		}

		expect(
			mergeBridgeOperationRows([fetchedRow], pendingBridgeTransactionRows([pendingRecord()]))
		).toEqual([fetchedRow])
	})
})
