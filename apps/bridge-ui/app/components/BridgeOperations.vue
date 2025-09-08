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
				hash: state.value.context.transaction?.hash ?? "",
				date:
					state.value.context.transaction?.date.toISOString() ??
					new Date().toISOString()
			}
		})
		.toSorted((a, b) => {
			const aIsDone = typeof a.status === "string" && a.status.includes("DONE")
			const bIsDone = typeof b.status === "string" && b.status.includes("DONE")
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
            <NetworkBadge :network="row.original.source" />
          </td>

          <!-- To cell: network label -->
          <td>
            <NetworkBadge :network="row.original.destination" />
          </td>

          <!-- Amount cell: add MINA suffix -->
          <td>
            <div class="AmountBox">
              <SvgMinaToken width="24" height="24" />
              <span>
                {{ String(row.getValue("amount")) }}
              </span>
            </div>
          </td>

          <!-- Date cell: placeholder date -->
          <td>
            {{ new Date(row.original.date).toLocaleDateString() }}
            <!-- {{ row.original.hash }} -->
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-if="data.length === 0">
          <td :colspan="columns.length">No transactions.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="postcss" scoped>
.BridgeOperations {
  width: 100%;
  max-width: 95vw;
  overflow-x: scroll;
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

.data-row {
  cursor: default;
}

.AmountBox {
  display: flex;
  gap: 1ch;
}
</style>
