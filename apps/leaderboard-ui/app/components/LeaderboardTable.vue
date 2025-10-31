<script lang="ts" setup>
import {
	getCoreRowModel,
	getPaginationRowModel,
	useVueTable
} from "@tanstack/vue-table"
import { useQuery } from "@urql/vue"
import { leaderboardQuery } from "@zeko/graphql/leaderboard"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

const props = defineProps<{ search?: string }>()

// Server uses a PAGE_SIZE of 50; align client page size with server behavior
const PAGE_SIZE = 50

// Cursor stack for back navigation (used only when not searching)
const cursorStack = ref<Array<{ score?: number; wallet?: string } | undefined>>(
	[]
)
const cursor = ref<{ score?: number; wallet?: string } | undefined>(undefined)

const isSearch = computed(() =>
	Boolean(props.search && props.search.trim().length > 0)
)

const variables = computed(() => {
	// When searching, server returns a centered window around the searched wallet; do not send cursor
	if (isSearch.value) {
		return { input: { searchWallet: props.search } }
	}
	return {
		input: {
			cursorScore: cursor.value?.score,
			cursorWallet: cursor.value?.wallet
		}
	}
})

const { data, fetching, executeQuery } = useQuery({
	query: leaderboardQuery,
	variables,
	requestPolicy: "network-only",
	pause: false
})

// Poll every 5s
let intervalId: number | undefined
onMounted(() => {
	// re-run poll by calling executeQuery in urql; useQuery auto-updates if variables refs change
	intervalId = window.setInterval(() => {
		executeQuery({ requestPolicy: "network-only" })
	}, 5000)
})
onBeforeUnmount(() => {
	if (intervalId) clearInterval(intervalId)
})

// Reset cursor when search changes
watch(
	() => props.search,
	() => {
		// Clear cursor state when search changes
		cursor.value = undefined
		cursorStack.value = []
		executeQuery({ requestPolicy: "network-only" })
	}
)

// Data and paging controls
const entries = computed(() =>
	(data.value?.leaderboard?.entries ?? []).map((e) => ({ ...e }))
)
const total = computed(() => data.value?.leaderboard?.total ?? 0)
const hasMore = computed(() => data.value?.leaderboard?.hasMore ?? false)

// Table setup
const columns = [
	{ accessorKey: "rank", header: "Rank" },
	{ accessorKey: "wallet", header: "Wallet" },
	{ accessorKey: "score", header: "Points" }
]

const table = useVueTable({
	data: entries,
	columns,
	getCoreRowModel: getCoreRowModel(),
	getPaginationRowModel: getPaginationRowModel(),
	initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } }
})

function goNext() {
	if (!hasMore.value || isSearch.value) return
	const items = entries.value
	if (items.length === 0) return

	// push current cursor so we can go back
	cursorStack.value.push(cursor.value ?? undefined)

	const last = items[items.length - 1] as { score: number; wallet: string }
	cursor.value = { score: last.score, wallet: last.wallet }
	executeQuery({ requestPolicy: "network-only" })
}

function goPrev() {
	if (cursorStack.value.length === 0 || isSearch.value) return
	const prev = cursorStack.value.pop()
	if (prev) cursor.value = prev
	else cursor.value = undefined
	executeQuery({ requestPolicy: "network-only" })
}
</script>

<template>
  <div class="LeaderboardTable">
    <div class="Summary">
      <div>Total: {{ total }}</div>
      <div v-if="fetching">Updating…</div>
    </div>

    <div class="TableFrame">
      <table>
        <thead>
          <tr>
            <th v-for="h of table.getHeaderGroups()[0]?.headers" :key="h.id">
              {{ h.column.columnDef.header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="fetching && entries.length === 0">
            <td :colspan="columns.length">Loading…</td>
          </tr>
          <tr v-for="row of table.getRowModel().rows" :key="row.id">
            <td>{{ row.getValue("rank") }}</td>
            <td>{{ row.getValue("wallet") }}</td>
            <td>{{ row.getValue("score") }}</td>
          </tr>
          <tr v-if="!fetching && entries.length === 0">
            <td :colspan="columns.length">No entries.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="Pager">
      <button @click="goPrev" :disabled="cursorStack.length === 0">Prev</button>
      <button @click="goNext" :disabled="!hasMore">Next</button>
    </div>
  </div>
</template>

<style scoped>
.LeaderboardTable .Summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.TableFrame {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #eee;
  text-align: left;
}
.Pager {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.75rem;
}
</style>
