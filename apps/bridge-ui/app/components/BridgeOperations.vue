<script lang="ts" setup>
import {
	// biome-ignore lint/correctness/noUnusedImports: <explanation>
	FlexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useVueTable
} from "@tanstack/vue-table"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { StepBackIcon, StepForwardIcon } from "lucide-vue-next"
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

// Pagination items per page
const pageSize = 7
const table = useVueTable({
	data,
	columns,
	getCoreRowModel: getCoreRowModel(),
	getPaginationRowModel: getPaginationRowModel(),
	initialState: { pagination: { pageIndex: 0, pageSize } }
})

const pageIndex = computed(() => table.getState().pagination.pageIndex)
const pageCount = computed(() =>
	Math.max(1, Math.ceil(data.value.length / pageSize))
)
</script>

<template>
  <div class="BridgeOperations" :class="{ paginated: pageCount > 1 }">
    <!-- Table wrapper -->
    <div
      class="TableFrame"
      role="region"
      :aria-label="`Bridge operations (page ${pageIndex + 1} of ${pageCount})`">
      <table id="bridge-operations-table">
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
          <tr
            v-for="row of table.getRowModel().rows"
            :key="row.id"
            class="data-row">
            <!-- Status -->
            <td>
              <Label :title="row.original.status" :is="row.original.statusKind">
                {{ row.original.statusText }}
              </Label>
            </td>
            <!-- From -->
            <td><NetworkBadge :network="row.original.source" /></td>
            <!-- To -->
            <td><NetworkBadge :network="row.original.destination" /></td>
            <!-- Amount -->
            <td>
              <div class="AmountBox">
                <SvgMinaLogo width="24" height="24" />
                <span>{{ String(row.getValue("amount")) }}</span>
              </div>
            </td>
            <!-- Date -->
            <td>{{ new Date(row.original.date).toLocaleDateString() }}</td>
          </tr>
          <tr v-if="table.getRowModel().rows.length === 0">
            <td :colspan="columns.length">No transactions.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav
      class="PaginationBar"
      v-if="pageCount > 1"
      aria-label="Pagination"
      aria-controls="bridge-operations-table">
      <button
        class="PageButton"
        :disabled="pageIndex === 0"
        @click="table.previousPage()"
        aria-label="Go to previous page">
        <StepBackIcon />
      </button>
      <ul class="PageList" role="list">
        <li v-for="i of pageCount" :key="i - 1">
          <button
            class="PageButton"
            :class="{ active: pageIndex === i - 1 }"
            @click="table.setPageIndex(i - 1)"
            :aria-label="`Go to page ${i}`"
            :aria-current='pageIndex === i - 1 ? "page" : undefined'>
            {{ i }}
          </button>
        </li>
      </ul>
      <button
        class="PageButton"
        :disabled="pageIndex >= pageCount - 1"
        @click="table.nextPage()"
        aria-label="Go to next page">
        <StepForwardIcon />
      </button>
      <span class="PageInfo" aria-live="polite">Page {{ pageIndex + 1 }} of {{
          pageCount
        }}
      </span>
    </nav>
  </div>
</template>

<style lang="postcss" scoped>
.BridgeOperations {
  width: 100%;
  max-width: 95vw;
  overflow-x: auto;
  display: grid;
  padding-bottom: 0.5rem;
  --rows-per-page: v-bind(pageSize);
  --bridge-row-height: 3rem;
  --bridge-border-color: var(--theme-light-border-secondary);
  --bridge-bg-alt: var(--theme-light-background-secondary);
  --bridge-focus-color: var(--palette-yellow-200);
  &.paginated {
    .TableFrame {
      min-height: calc(var(--bridge-row-height) * (var(--rows-per-page) + 1));
    }
  }
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  text-align: left;
}

thead th, tbody td {
  padding-inline: 1rem;
  padding-block: 0.5rem;
  border-bottom: 1px solid var(--bridge-border-color);
}

tbody tr {
  height: var(--bridge-row-height);
}

thead th {
  font-weight: 600;
  opacity: 0.8;
}

tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.AmountBox {
  display: flex;
  gap: 1ch;
}

.PaginationBar {
  margin: 1rem auto auto auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  font-size: var(--typography_fluid-lexend-s);
}

.PageList {
  display: flex;
  gap: 0.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.PageButton {
  --bg: var(--palette-basic-spaceBlue);
  --fg: var(--theme-light-content-tertiary);
  --bd: var(--bridge-border-color);
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--bd);
  background: var(--bg);
  color: var(--fg);
  border-radius: 0.375rem;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
  &.active {
    --bg: var(--palette-yellow-200);
  }
  &:hover:not([disabled]) {
    background: color-mix(in oklab, var(--bg), var(--bridge-bg-alt) 40%);
  }
  &:focus-visible {
    outline: 2px solid var(--bridge-focus-color);
    outline-offset: 2px;
  }
  &[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
  }
  svg {
    width: 1rem;
    height: 1rem;
  }
}

.PageInfo {
  margin-left: 0.5rem;
  font-size: var(--typography_fluid-lexend-s);
  opacity: 0.7;
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .PageButton {
    transition: none;
  }
}
</style>
