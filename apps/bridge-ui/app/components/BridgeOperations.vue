<script lang="ts" setup>
import {
	FlexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useVueTable
} from "@tanstack/vue-table"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-vue-next"
import { computed } from "vue"
import type { ActorRefFromLogic } from "xstate"
import {
	shouldShowCompletedOperationsLoading,
	statusFromState
} from "~/helpers"
import {
	bridgeOperationColumns,
	completedOperationTableStatus,
	mergeBridgeOperationRows,
	pendingBridgeTransactionRows,
	type BridgeOperationRow
} from "~/utils/bridgeOperationsTable"
import {
	formatOperationDate,
	sortOperationTimestampsDesc
} from "~~/machines/operationTimestamps"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import type { PendingBridgeTransaction } from "~~/machines/pendingTransactions"
import { useSelector } from "~~/machines/vue-xstate"

const { operations, pendingOperations = [] } = defineProps<{
	operations: {
		id: string
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}[]
	pendingOperations?: PendingBridgeTransaction[]
}>()

const bs = useBridgeStore()
const loading = computed(() =>
	shouldShowCompletedOperationsLoading({
		bridgeReady: bs.bridge.snapshot.matches("READY"),
		operationCount: operations.length
	})
)

const data = computed<BridgeOperationRow[]>(() => {
	const fetchedRows = operations.map(({ id, operation }) => {
		const state = useSelector(operation, (state) => state)
		const status = statusFromState(
			state.value.value,
			state.value.context.direction,
			{ canCancel: state.value.context.canCancel }
		)
		const { text, kind } = completedOperationTableStatus(
			status,
			state.value.context.completionVerification
		)
		const timestampMs =
			state.value.context.transaction?.timestampMs ??
			state.value.context.completedAtMs ??
			null
		const submitHash =
			state.value.context.transactions.submitDeposit?.result?.hash ??
			state.value.context.transactions.submitWithdrawal?.result?.hash ??
			""
		return {
			id,
			operation,
			status: state.value.value,
			statusText: text,
			statusKind: kind,
			source: state.value.context.source,
			destination: state.value.context.destination,
			amount: state.value.context.amount,
			hash: submitHash || state.value.context.transaction?.hash || "",
			timestampMs,
			dateLabel: formatOperationDate(timestampMs)
		}
	})
	const pendingRows = pendingBridgeTransactionRows(pendingOperations)
	return mergeBridgeOperationRows(fetchedRows, pendingRows).toSorted((a, b) => {
		const aIsDone = typeof a.status === "string" && a.status.includes("DONE")
		const bIsDone = typeof b.status === "string" && b.status.includes("DONE")
		if (aIsDone !== bIsDone) return aIsDone ? 1 : -1
		return sortOperationTimestampsDesc(a.timestampMs, b.timestampMs)
	})
})

const columns = bridgeOperationColumns

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

const placeholderRows = computed(() =>
	loading.value
		? Array.from({ length: 3 }, (_, i) => ({ id: `placeholder-${i}` }))
		: []
)

const visiblePages = computed(() => {
	const total = pageCount.value
	const current = pageIndex.value
	if (total <= 5) return Array.from({ length: total }, (_, i) => i)

	const pages: (number | string)[] = [0]
	if (current <= 2) {
		pages.push(1, 2, "...", total - 1)
	} else if (current >= total - 3) {
		pages.push("...", total - 3, total - 2, total - 1)
	} else {
		pages.push("...", current, "...", total - 1)
	}
	return pages
})
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
              v-for="header in table.getHeaderGroups()[0]?.headers"
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
          <!-- Loading placeholder rows -->
          <tr
            v-if="loading"
            v-for="placeholder in placeholderRows"
            :key="placeholder.id"
            class="placeholder-row">
            <td v-for="col in columns.length" :key="col"><LoadingBar /></td>
          </tr>
          <!-- Real data rows -->
          <tr
            v-else
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="data-row">
            <!-- Status -->
            <td>
              <Label
                class="Table"
                :title="String(row.original.status)"
                :is="row.original.statusKind">
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
                <span>{{ String(row.getValue("amount")) }}</span>
                <SvgMinaLogo width="24" height="24" />
                <span>MINA</span>
              </div>
            </td>
            <!-- Hash -->
            <td>
              <span class="HashCell" :title='String(row.getValue("hash"))'>
                {{ String(row.getValue("hash") || "none") }}
              </span>
            </td>
            <!-- Date -->
            <td>{{ String(row.getValue("date")) }}</td>
          </tr>
          <tr v-if="!loading && table.getRowModel().rows.length === 0">
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
        class="PageButton PrevNext"
        :disabled="pageIndex === 0"
        @click="table.previousPage()"
        aria-label="Go to previous page">
        <ChevronLeftIcon />
      </button>
      <ul class="PageList" role="list">
        <li v-for="(page, idx) in visiblePages" :key="`page-${idx}`">
          <button
            v-if='typeof page === "number"'
            class="PageButton"
            :class="{ active: pageIndex === page }"
            @click="table.setPageIndex(page)"
            :aria-label="`Go to page ${page + 1}`"
            :aria-current='pageIndex === page ? "page" : undefined'>
            {{ page + 1 }}
          </button>
          <span v-else class="Ellipsis" aria-hidden="true">...</span>
        </li>
      </ul>
      <button
        class="PageButton PrevNext"
        :disabled="pageIndex >= pageCount - 1"
        @click="table.nextPage()"
        aria-label="Go to next page">
        <ChevronRightIcon />
      </button>
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

th,
td {
  text-align: left;
}

thead th,
tbody td {
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
  display: grid;
  grid-template-columns: minmax(4ch, max-content) min-content auto;
  gap: 1ch;
  span:first-child {
    justify-self: end;
  }
}

.HashCell {
  display: inline-block;
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em;
  white-space: nowrap;
}

.PaginationBar {
  margin-block-start: 1rem;
  margin-inline: auto;
  display: flex;
  align-items: center;
  font-size: var(--typography_fluid-lexend-s);
  border: 1px solid var(--bridge-border-color);
  border-radius: 0.5rem;
  width: fit-content;
}

.PageList {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
}

.PageButton {
  --bg: transparent;
  --fg: var(--theme-light-content-primary);
  --bd: var(--palette-gray-200);
  min-width: 2.5rem;
  block-size: 2.5rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-inline-end: 1px solid var(--bd);
  border-radius: 0;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  font-weight: 400;
  transition: background-color 120ms ease;
  &.active {
    --bg: var(--palette-gray-100);
    font-weight: 600;
    border-inline: 1px solid var(--bd);
  }
  &.PrevNext {
    &:hover:not([disabled]) {
      --bg: var(--bridge-bg-alt);
    }
    &:first-child {
      border-start-start-radius: 0.5rem;
      border-end-start-radius: 0.5rem;
    }
    &:last-child {
      border-inline-end: none;
      border-start-end-radius: 0.5rem;
      border-end-end-radius: 0.5rem;
    }
  }
  &:hover:not([disabled]):not(.active) {
    --bg: var(--bridge-bg-alt);
  }
  &:focus-visible {
    outline: 2px solid var(--bridge-focus-color);
    outline-offset: -2px;
    z-index: 1;
  }
  &[disabled] {
    opacity: 0.3;
    cursor: not-allowed;
  }
  svg {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }
}

.Ellipsis {
  color: var(--theme-light-content-tertiary);
  opacity: 0.6;
  padding-inline: 0.5rem;
  user-select: none;
  border-inline-end: 1px solid var(--bridge-border-color);
  display: flex;
  align-items: center;
  block-size: 2.5rem;
}

tbody tr.placeholder-row {
  height: var(--bridge-row-height);
}

@media (prefers-reduced-motion: reduce) {
  .PageButton {
    transition: none;
  }
}
</style>
