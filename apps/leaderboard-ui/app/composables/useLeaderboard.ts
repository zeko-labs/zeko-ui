import { getCoreRowModel, getPaginationRowModel, useVueTable } from "@tanstack/vue-table"
import { useQuery } from "@urql/vue"
import { leaderboardQuery } from "@zeko/graphql/leaderboard"
import { defineStore } from "pinia"

const pollingInterval = 5000
const PAGE_SIZE = 20

export const useLeaderboard = defineStore("leaderboard", () => {
	const search = ref("")

	// Cursor stack for back navigation (used only when not searching)
	const cursorStack = ref<Array<{ score?: number; wallet?: string } | undefined>>([])
	const cursor = ref<{ score?: number; wallet?: string } | undefined>(undefined)

	const isSearch = computed(() => search.value.trim().length > 0)

	const variables = computed(() => {
		// When searching, server returns a centered window around the searched wallet; do not send cursor
		if (isSearch.value) {
			return { input: { searchWallet: search } }
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

	// Data and paging controls
	const entries = computed(() => data.value?.leaderboard?.entries ?? [])
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

	// Poll every 5s
	let intervalId: number | undefined
	onMounted(() => {
		// re-run poll by calling executeQuery in urql; useQuery auto-updates if variables refs change
		intervalId = window.setInterval(() => {
			executeQuery({ requestPolicy: "network-only" })
		}, pollingInterval)
	})
	onBeforeUnmount(() => {
		if (intervalId) clearInterval(intervalId)
	})

	// Reset cursor when search changes
	watch(search, () => {
		// Clear cursor state when search changes
		cursor.value = undefined
		cursorStack.value = []
		executeQuery({ requestPolicy: "network-only" })
	})

	return {
		search,
		entries,
		total,
		table,
		data,
		fetching,
		executeQuery,
		goNext,
		goPrev,
		hasMore,
		isSearch,
		columns,
		cursorStack
	}
})
