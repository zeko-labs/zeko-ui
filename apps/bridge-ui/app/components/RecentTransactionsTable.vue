<script lang="ts" setup>
import type { ColumnDef } from "@tanstack/vue-table"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { FlexRender, getCoreRowModel, useVueTable } from "@tanstack/vue-table"
import { computed } from "vue"
import type { ActorRefFromLogic } from "xstate"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

export type OperationRow = {
	id: string
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	status: string
	source: string
	destination: string
	amount: string
	date: string
}

const { operations } = defineProps<{
	operations: Array<{
		id: string
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}>
}>()

// Map operations to row data reactively
const rows = computed<OperationRow[]>(() =>
	operations.map(({ id, operation }) => {
		const snapshot = operation.getSnapshot()
		return {
			id,
			operation,
			status: snapshot.value.toString(),
			source: snapshot.context.source,
			destination: snapshot.context.destination,
			amount: snapshot.context.amount,
			date: new Date().toLocaleDateString()
		}
	})
)

// Column definitions
const columns = computed<ColumnDef<OperationRow>[]>(() => [
	{ accessorKey: "status", header: "Status" },
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

// local expand state per row id
const expanded = ref<Set<string>>(new Set())
const toggleRow = (id: string) => {
	const next = new Set(expanded.value)
	next.has(id) ? next.delete(id) : next.add(id)
	expanded.value = next
}
</script>

<template>
  <div class="RecentTransactionsTable">
    <table>
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
      <tbody>
        <tr
          v-for="row of table.getRowModel().rows"
          :key="row.id"
          class="data-row"
          @click="toggleRow(String(row.original.id))">
          <td v-for="cell of row.getVisibleCells()" :key="cell.id">
            <template v-if='cell.column.id === "status"'>
              <Label
                :is='
                  String(row.getValue("status")).toLowerCase().includes("done")
                  ? "complete"
                  : "pending"
                '
              />
            </template>
            <template v-else>
              <FlexRender
                :render="cell.column.columnDef.cell ?? cell.column.columnDef.header"
                :props="cell.getContext()"
              />
            </template>
          </td>
        </tr>
        <tr
          v-for="row of table.getRowModel().rows"
          :key='row.id + "-details"'
          v-show="expanded.has(String(row.original.id))"
          class="detail-row">
          <td :colspan="columns.length">
            <Operation :operation="row.original.operation" />
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length">No recent transactions.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="postcss" scoped>
.RecentTransactionsTable {
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

.data-row {
  cursor: pointer;
}

.detail-row td {
  background: rgba(0, 0, 0, 0.03);
}
</style>
