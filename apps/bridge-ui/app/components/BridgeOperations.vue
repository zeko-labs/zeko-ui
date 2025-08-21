<script lang="ts" setup>
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { FlexRender, getCoreRowModel, useVueTable } from "@tanstack/vue-table"
import { computed } from "vue"
import type { ActorRefFromLogic } from "xstate"
import { statusFromState } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const { operations } = defineProps<{
	operations: {
		id: string
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}[]
}>()

const data = computed(() =>
	operations
		.map(({ id, operation }) => {
			// const state = useSelector(operation, (state) => state)
			const state = computed(() => operation.getSnapshot())
			const { text, kind } = statusFromState(
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
				hash: state.value.context.transaction?.hash ?? "no-hash",
				date:
					state.value.context.transaction?.date.toLocaleDateString() ??
					new Date().toLocaleDateString()
			}
		})
		.toSorted((a, b) => {
			const aIsDone = a.status.includes("DONE")
			const bIsDone = b.status.includes("DONE")
			if (aIsDone && !bIsDone) return 1 // If a is DONE and b is NOT DONE, a goes after b (return 1).
			if (!aIsDone && bIsDone) return -1 // If a is NOT DONE and b is DONE, a goes before b (return -1).
			return b.date.localeCompare(a.date) // If both both DONE or both not DONE, sort them by date.
		})
)

// Column definitions
const columns = [
	{ accessorKey: "statusText", header: "Status" },
	{ accessorKey: "source", header: "From" },
	{ accessorKey: "destination", header: "To" },
	{ accessorKey: "amount", header: "Amount" },
	{ accessorKey: "date", header: "Date" }
]

const table = useVueTable({
	data,
	columns,
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
            <NetworkTarget :network="row.original.source"></NetworkTarget>
          </td>

          <!-- To cell: network label -->
          <td>
            <NetworkTarget :network="row.original.destination"></NetworkTarget>
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
        <tr v-if="data.length === 0">
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
