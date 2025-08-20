<script lang="ts" setup>
import type { Networks } from "@lumina-dex/sdk"
import { useSelector } from "@lumina-dex/sdk/vue"
import type { ColumnDef } from "@tanstack/vue-table"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { FlexRender, getCoreRowModel, useVueTable } from "@tanstack/vue-table"
import { computed } from "vue"
import type { ActorRefFromLogic } from "xstate"
import { depositSteps, withdrawalSteps } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

type Direction = "deposit" | "withdrawal"

type MachineStates = ReturnType<
	(typeof bridgeOperationMachine)["getInitialSnapshot"]
>["value"]

const { operations } = defineProps<{
	operations: {
		id: string
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}[]
}>()

export type OperationRow = {
	id: string
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	status: MachineStates
	statusText: string
	statusKind: "pending" | "complete"
	source: Networks
	destination: Networks
	amount: string
	date: string
}

const friendlyNetwork = (n: string) => {
	const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
	const words = n.split(":") as [string, string]
	return `${capitalize(words[0])} ${capitalize(words[1])}`
}

const deposit = (kind: "pending" | "complete") => (step: number) => ({
	text: depositSteps[step] as (typeof depositSteps)[number],
	kind
})
const withdrawal = (kind: "pending" | "complete") => (step: number) => ({
	text: withdrawalSteps[step] as (typeof withdrawalSteps)[number],
	kind
})
const pendingDeposit = deposit("pending")
const pendingWithdrawal = withdrawal("pending")
const mapStatus = (
	state: MachineStates,
	direction: Direction
): { text: string; kind: "pending" | "complete" } => {
	const isDeposit = direction === "deposit"
	switch (state) {
		case "BRIDGE_OPERATION_DONE":
		case "BRIDGE_OPERATION_DONE_NOOP":
			return isDeposit ? deposit("complete")(2) : withdrawal("complete")(2)
		case "SUBMIT_DEPOSIT":
			return pendingDeposit(0)
		case "PENDING_DEPOSIT":
			return pendingDeposit(1)
		case "FINALIZE_DEPOSIT":
			return pendingDeposit(2)
		case "SUBMIT_WITHDRAWAL":
			return pendingWithdrawal(0)
		case "PENDING_WITHDRAWAL":
			return pendingWithdrawal(1)
		case "FINALIZE_WITHDRAWAL":
			return pendingWithdrawal(2)
		case "TO_FINALIZE":
			return isDeposit ? pendingDeposit(2) : pendingWithdrawal(2)
		case "PAUSED":
			return { text: "Paused", kind: "pending" }
		case "IDLE":
			return { text: "Idle", kind: "pending" }
		default:
			return isDeposit ? pendingDeposit(1) : pendingWithdrawal(1)
	}
}

const rows = computed<OperationRow[]>(() =>
	operations
		.map(({ id, operation }) => {
			const state = useSelector(operation, (state) => state)
			const { text, kind } = mapStatus(
				state.value.value,
				state.value.context.direction
			)
			return {
				id,
				operation,
				status: state.value.value,
				statusText: text,
				statusKind: kind,
				source: state.value.context.source,
				destination: state.value.context.destination,
				amount: state.value.context.amount,
				date: new Date().toLocaleDateString()
			}
		})
		.toSorted((a, b) => {
			const aIsDone = a.status.includes("DONE")
			const bIsDone = b.status.includes("DONE")
			if (aIsDone && !bIsDone) return 1 // If a is DONE and b is NOT DONE, a goes after b (return 1).
			if (!aIsDone && bIsDone) return -1 // If a is NOT DONE and b is DONE, a goes before b (return -1).
			return 0 // If both both DONE or both not DONE, preserves the initial order(return 0).
		})
)

// Column definitions
const columns = computed<ColumnDef<OperationRow>[]>(() => [
	{ accessorKey: "statusText", header: "Status" },
	{ accessorKey: "source", header: "From" },
	{ accessorKey: "destination", header: "To" },
	{ accessorKey: "amount", header: "Amount" },
	{ accessorKey: "date", header: "Date" }
])

const table = useVueTable({
	get data() {
		return rows.value
	},
	get columns() {
		return columns.value
	},
	getCoreRowModel: getCoreRowModel()
})
</script>

<template>
  <div class="BridgeOperations">
    <!-- <template v-for="operation of operations">
      <pre>{{  operation.operation.getSnapshot().value }}</pre>
    </template> -->
    <!-- Table wrapper -->
    <table>
      <!-- Header -->
      <thead>
        <tr>
          <th
            v-for="header of table.getHeaderGroups()[0]?.headers"
            :key="header.id">
            <FlexRender
              :render="header.column.columnDef.header"
              :props="header.getContext()"
            />
          </th>
        </tr>
      </thead>

      <!-- Body -->
      <tbody>
        <!-- One visual row per operation -->
        <tr
          v-for="row of table.getRowModel().rows"
          :key="row.id"
          class="data-row">
          <!-- Status cell: explicit step badge -->
          <td>
            <Label :title="row.original.status" :is="row.original.statusKind">
              {{ row.original.statusText }}
            </Label>
          </td>

          <!-- From cell: network label -->
          <td>
            <span
              class="network"
              :class='
                row.original.source.startsWith("mina:")
                ? "network-mina"
                : "network-zeko"
              '>
              {{ friendlyNetwork(String(row.getValue("source"))) }}
            </span>
          </td>

          <!-- To cell: network label -->
          <td>
            <span
              class="network"
              :class='
                row.original.destination.startsWith("mina:")
                ? "network-mina"
                : "network-zeko"
              '>
              {{ friendlyNetwork(String(row.getValue("destination"))) }}
            </span>
          </td>

          <!-- Amount cell: add MINA suffix -->
          <td>
            {{ String(row.getValue("amount")) }} MINA
          </td>

          <!-- Date cell: placeholder date -->
          <td>
            {{ String(row.getValue("date")) }}
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length">No recent transactions.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="postcss" scoped>
.BridgeOperations {
  width: 100%;
}

:where(table) {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

thead th {
  font-weight: 600;
  opacity: 0.8;
}

tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Network label styles */
.network {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: 999px;
  border: 1px solid transparent;
}
.network-mina {
  color: #501a5d;
  background: #f9ebff;
  border-color: #f8bef2;
}
.network-zeko {
  color: #1d4044;
  background: #e6fffa;
  border-color: #b2f5ea;
}

.data-row {
  cursor: default;
}
</style>
