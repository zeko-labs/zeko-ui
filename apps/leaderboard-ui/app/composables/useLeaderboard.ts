import { getCoreRowModel, getPaginationRowModel, useVueTable } from "@tanstack/vue-table"
import { useQuery, useSubscription } from "@urql/vue"
import { leaderboardQuery, leaderboardUpdateSubscription } from "@zeko-labs/graphql/leaderboard"
import { defineStore } from "pinia"

const PAGE_SIZE = 20
const WALLET_ADDRESS_LENGTH = 55

export const useLeaderboard = defineStore("leaderboard", () => {
	const search = ref("")
	const transactionCount = ref(0)
	const page = ref(1)
	const searchWallet = ref("")

	const variables = computed(() => ({
		input: {
			page: page.value,
			pageSize: PAGE_SIZE,
			searchWallet: searchWallet.value.length > 0 ? searchWallet.value : undefined
		}
	}))

	const { data, fetching, executeQuery } = useQuery({
		query: leaderboardQuery,
		variables,
		requestPolicy: "network-only",
		pause: false
	})

	// Data and paging controls
	const entries = computed(() => data.value?.leaderboard?.entries ?? [])
	const totalPoints = computed(() => data.value?.leaderboard?.totalPoints ?? 0)
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
		if (!hasMore.value) return
		page.value++
	}

	function goPrev() {
		if (page.value <= 1) return
		page.value--
	}

	const {
		data: subscriptionData,
		error: subscriptionError,
		fetching: subscriptionFetching,
		executeSubscription
	} = useSubscription({
		query: leaderboardUpdateSubscription
	})

	// Handle subscription errors - retry after 2s
	watch(subscriptionError, (error) => {
		if (error) {
			console.warn("[useLeaderboard] Subscription error, retrying in 2s:", error)
			setTimeout(() => {
				executeSubscription()
			}, 2000)
		}
	})

	// Handle subscription completion/disconnect - reconnect immediately
	// When SSE stream ends, fetching goes from true to false
	watch(subscriptionFetching, (isFetching, wasFetching) => {
		if (wasFetching && !isFetching && !subscriptionError.value) {
			console.log("[useLeaderboard] Subscription completed/disconnected, reconnecting...")
			executeSubscription()
		}
	})

	watch(
		() => subscriptionData.value?.onNewTransaction,
		(update) => {
			if (!update) return
			transactionCount.value = update.maxBlockHeight
			if (update.hasNewEntries) {
				executeQuery()
			}
		}
	)

	watch(search, (newSearch) => {
		if (newSearch.length === WALLET_ADDRESS_LENGTH) {
			page.value = 1
			searchWallet.value = newSearch
		} else {
			searchWallet.value = ""
		}
	})

	return {
		search,
		entries,
		totalPoints,
		table,
		data,
		fetching,
		executeQuery,
		goNext,
		goPrev,
		hasMore,
		columns,
		page,
		transactionCount
	}
})
