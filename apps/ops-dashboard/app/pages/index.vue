<script lang="ts" setup>
import {
	Activity,
	Database,
	Play,
	RefreshCcw,
	RotateCcw,
	Server,
	Square,
	Zap
} from "lucide-vue-next"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import {
	buildChainInsight,
	finalityState,
	gapLabel,
	gapState,
	tailState,
	type ChainInsight
} from "~/utils/ops-insights"

type ServiceStatus = "ok" | "warn" | "error" | "unknown"
type ServiceKind = "actions-indexer" | "archive" | "daemon"
type OpsNetwork = "mainnet" | "testnet"

interface ServiceProbe {
	id: string
	label: string
	kind: ServiceKind
	status: ServiceStatus
	endpoint: string
	checkedAt: string
	latencyMs: number | null
	httpStatus: number | null
	details: Record<string, string | number | boolean | null>
	error?: string
}

interface OpsSnapshot {
	checkedAt: string
	config: {
		network: OpsNetwork
		actionsIndexerUrl: string
		l1ArchiveUrl: string
		l2ArchiveUrl: string
		l1DaemonUrl: string
		l2DaemonUrl: string
		outerActionsPublicKey: string
		innerActionsPublicKey: string
	}
	summary: Record<ServiceStatus, number>
	services: ServiceProbe[]
}

interface ActionCoverageSnapshot {
	l1: ServiceProbe["details"]
	l2: ServiceProbe["details"]
}

type ControlAction = "start" | "stop" | "rebuild" | "reset"
type ChainRow = ChainInsight & {
	archive?: ServiceProbe
	daemon?: ServiceProbe
}

const route = useRoute()
const router = useRouter()
const resolveNetworkFromQuery = (value: unknown): OpsNetwork => {
	const raw = Array.isArray(value) ? value[0] : value
	return raw === "testnet" || raw === "mainnet" ? raw : "mainnet"
}

const snapshot = ref<OpsSnapshot | null>(null)
const isRefreshing = ref(false)
const activeAction = ref<ControlAction | null>(null)
const errorMessage = ref<string | null>(null)
const actionMessage = ref<string | null>(null)
const selectedNetwork = ref<OpsNetwork>(
	resolveNetworkFromQuery(route.query.network)
)
const refreshIntervalMs = 30_000
const lastRefreshStartedAt = ref<string | null>(null)
let refreshTimer: ReturnType<typeof setInterval> | null = null
let refreshSequence = 0

const serviceIcon = (service: ServiceProbe) => {
	if (service.kind === "actions-indexer") return Activity
	if (service.kind === "archive") return Database
	return Server
}

const services = computed(() => snapshot.value?.services ?? [])
const currentNetwork = computed(
	() => snapshot.value?.config.network ?? selectedNetwork.value
)
const pendingNetwork = computed(() =>
	snapshot.value !== null && currentNetwork.value !== selectedNetwork.value
		? selectedNetwork.value
		: null
)
const loadingLabel = computed(() => {
	if (!isRefreshing.value) return null
	if (pendingNetwork.value !== null)
		return `Loading ${pendingNetwork.value} snapshot`
	if (snapshot.value === null) return "Loading snapshot"
	return "Refreshing snapshot"
})
const serviceById = computed(
	() => new Map(services.value.map((service) => [service.id, service]))
)
const indexerService = computed(() => serviceById.value.get("actions-indexer"))
const chainRows = computed<ChainRow[]>(() => {
	const indexer = indexerService.value
	const l1Archive = serviceById.value.get("l1-archive")
	const l1Daemon = serviceById.value.get("l1-daemon")
	const l2Archive = serviceById.value.get("l2-archive")
	const l2Daemon = serviceById.value.get("l2-daemon")

	return [
		{
			...buildChainInsight({
				id: "l1",
				label: "L1 Mina actions",
				indexerLabel: "L1",
				indexer,
				archive: l1Archive,
				daemon: l1Daemon,
				indexerHeightKey: "lastFetchedOuter",
				indexerFinalHeightKey: "outerLastFinalBlockHeight",
				nonCanonicalTailKey: "outerNonCanonicalTailCount",
				expectedFinalityBlocks: 290,
				daemonBlockHeightSupported: true
			}),
			archive: l1Archive,
			daemon: l1Daemon
		},
		{
			...buildChainInsight({
				id: "l2",
				label: "L2 Zeko actions",
				indexerLabel: "L2",
				indexer,
				archive: l2Archive,
				daemon: l2Daemon,
				indexerHeightKey: "lastFetchedInner",
				indexerFinalHeightKey: "innerLastFinalBlockHeight",
				nonCanonicalTailKey: "innerNonCanonicalTailCount",
				expectedFinalityBlocks: null,
				daemonBlockHeightSupported: false
			}),
			archive: l2Archive,
			daemon: l2Daemon
		}
	]
})
const formatDate = (value: string | null | undefined) => {
	if (!value) return "-"
	return new Intl.DateTimeFormat("en", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		month: "short",
		day: "2-digit"
	}).format(new Date(value))
}

const formatValue = (value: string | number | boolean | null) => {
	if (value === null) return "-"
	if (typeof value === "boolean") return value ? "yes" : "no"
	if (typeof value === "number")
		return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
	return value
}

const formatBlock = (value: number | null) =>
	value === null ? "-" : value.toLocaleString()
const pendingActionLabel = (row: ChainRow) => {
	if (row.nonCanonicalTailCount === null) return "pending actions unknown"
	if (row.nonCanonicalTailCount === 0) return "no pending actions"
	const unit = row.nonCanonicalTailCount === 1 ? "action" : "actions"
	return `${row.nonCanonicalTailCount.toLocaleString()} ${unit} waiting finality`
}
const finalityGapLabel = (row: ChainRow) => {
	if (row.id === "l2") return "72h action finality"
	if (row.archiveFinalityGap === null) return "finality unknown"
	return `${row.archiveFinalityGap.toLocaleString()} blocks not final`
}
const finalityDetail = (row: ChainRow) => {
	if (row.id === "l1") return "L1 finality target: 290 blocks"
	return "L2 actions finalize after 72 hours"
}
const coverageState = (row: ChainRow): ServiceStatus => {
	if (row.actionCoverageStatus === "missing") return "error"
	if (row.actionCoverageStatus === "current") return "ok"
	if (row.actionCoverageStatus === "partial") return "warn"
	return "unknown"
}
const emptySummary = (): Record<ServiceStatus, number> => ({
	ok: 0,
	warn: 0,
	error: 0,
	unknown: 0
})
const summarizeStates = (states: ServiceStatus[]) =>
	states.reduce<Record<ServiceStatus, number>>(
		(summary, state) => ({
			...summary,
			[state]: summary[state] + 1
		}),
		emptySummary()
	)
const indexerHeaderState = computed<ServiceStatus>(() => {
	const serviceState = indexerService.value?.status ?? "unknown"
	if (serviceState === "error" || serviceState === "warn") return serviceState
	if (chainRows.value.some((row) => coverageState(row) === "error"))
		return "error"
	if (chainRows.value.some((row) => coverageState(row) === "warn"))
		return "warn"
	return serviceState
})
const indexerHeaderLabel = computed(() => {
	if (indexerService.value === undefined) return "Indexer loading"
	if (indexerHeaderState.value === "error") return "Indexer missing data"
	if (indexerHeaderState.value === "warn") return "Indexer needs review"
	return `Indexer ${indexerService.value.status}`
})
const dashboardCheckStates = computed<ServiceStatus[]>(() => {
	if (snapshot.value === null) return []
	return [
		...services.value.map((service) => service.status),
		...chainRows.value.flatMap((row) => [
			coverageState(row),
			tailState(row.nonCanonicalTailCount, row.expectedFinalityBlocks),
			row.daemonBlockHeightSupported ? gapState(row.archiveDaemonGap) : "ok"
		])
	]
})
const displayedSummary = computed(() =>
	summarizeStates(dashboardCheckStates.value)
)
const lagUnit = (row: ChainRow, value: number) => {
	const noun = row.id === "l2" ? "tx" : "block"
	return value === 1 ? noun : `${noun}s`
}
const indexerLagLabel = (row: ChainRow) => {
	if (row.lastActionGap === null) return "indexer lag unknown"
	if (row.lastActionGap <= 0) return "indexer at archive head"
	return `${row.lastActionGap.toLocaleString()} ${lagUnit(row, row.lastActionGap)} behind archive head`
}
const coverageScanLabel = (row: ChainRow) => {
	if (row.actionScanFrom === null || row.actionScanTo === null)
		return "coverage scan unavailable"
	return `scanned ${formatBlock(row.actionScanFrom)}-${formatBlock(row.actionScanTo)}`
}
const coverageLabel = (row: ChainRow) => {
	if (row.actionCoverageStatus === "missing") {
		const count = row.missingActionCount ?? row.missingActionBlockCount ?? 0
		const unit = count === 1 ? "action" : "actions"
		return `${count.toLocaleString()} missing archive ${unit}`
	}
	if (
		row.actionCoverageStatus === "current" &&
		row.id === "l2" &&
		(row.lastActionGap ?? 0) > 0
	)
		return "no missing L2 actions found"
	if (row.actionCoverageStatus === "current")
		return "DB has latest archive actions"
	if (row.actionCoverageStatus === "partial") return "coverage scan incomplete"
	return "coverage unknown"
}
const coverageDetail = (row: ChainRow) => {
	if (row.actionCoverageError) return row.actionCoverageError
	if (row.actionCoverageStatus === "missing")
		return `first missing block ${formatBlock(row.firstMissingActionBlock)}`
	if (
		row.actionCoverageStatus === "current" &&
		row.id === "l2" &&
		(row.lastActionGap ?? 0) > 0
	)
		return `archive head is ${formatBlock(row.archiveHeight)}; latest indexed L2 action is ${formatBlock(row.lastActionBlockHeight)}; ${coverageScanLabel(row)} found no newer actions`
	if (row.actionCoverageStatus === "partial")
		return `${coverageScanLabel(row)}; latest archive action ${formatBlock(row.latestArchiveActionBlock)}`
	return `${indexerLagLabel(row)}; archive head ${formatBlock(row.archiveHeight)}; indexer fetched ${formatBlock(row.lastActionBlockHeight)}`
}
const archiveDaemonGapLabel = (gap: number | null) =>
	gapLabel(gap, "archive ahead", "daemon ahead")
const archiveDaemonSummary = (row: ChainRow) =>
	row.daemonBlockHeightSupported
		? archiveDaemonGapLabel(row.archiveDaemonGap)
		: "L2 exposes tx height through archive"
const rowServices = (row: ChainRow): ServiceProbe[] =>
	[row.archive, row.daemon].filter((service): service is ServiceProbe =>
		Boolean(service)
	)
const detailValue = (service: ServiceProbe, key: string) =>
	service.details[key] ?? null

const indexerDbAgeSeconds = computed(() => {
	const value = indexerService.value?.details.canonicalAgeMs
	return typeof value === "number" ? Math.round(value / 1000) : null
})

const formatDetailKey = (key: string) =>
	key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase())

const detailPriority = (key: string) => {
	if (key.startsWith("database")) return 0
	if (
		key.startsWith("canonical") ||
		key.startsWith("outer") ||
		key.startsWith("inner")
	)
		return 1
	if (key.startsWith("lastFetched")) return 2
	return 3
}

const detailEntries = (service: ServiceProbe) =>
	Object.entries(service.details)
		.filter(([, value]) => value !== null && value !== "")
		.sort(
			([leftKey], [rightKey]) =>
				detailPriority(leftKey) - detailPriority(rightKey) ||
				leftKey.localeCompare(rightKey)
		)
		.map(([key, value]) => ({
			key,
			label: formatDetailKey(key),
			value,
			isDatabase: key.startsWith("database")
		}))

const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: {}

const asNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : null
	}
	return null
}

const asString = (value: unknown): string | null =>
	typeof value === "string" && value.trim() !== "" ? value : null

const directIndexerDetails = (
	healthPayload: unknown,
	statusPayload: unknown
): ServiceProbe["details"] => {
	const health = asRecord(healthPayload)
	const service = asRecord(health.service)
	const database = asRecord(health.database)
	const indexer = asRecord(health.indexer)
	const lastFetchedBlock = asRecord(indexer.lastFetchedBlock)
	const canonicalProgress = asRecord(indexer.canonicalProgress)
	const outer = asRecord(canonicalProgress.outer)
	const inner = asRecord(canonicalProgress.inner)
	const status = asRecord(statusPayload)

	return {
		health: asString(health.status),
		environment: asString(service.environment),
		databaseStatus: asString(database.status),
		databaseLatencyMs: asNumber(database.latency_ms ?? database.latencyMs),
		databaseCheckedAt: asString(database.checkedAt),
		databaseAgeMs: asNumber(database.ageMs),
		indexer: asString(indexer.status),
		consecutiveErrors: asNumber(indexer.consecutiveErrors),
		lastFetchedOuter: asNumber(lastFetchedBlock.outer),
		lastFetchedInner: asNumber(lastFetchedBlock.inner),
		running: typeof status.isRunning === "boolean" ? status.isRunning : null,
		intervalSeconds: asNumber(asRecord(status.config).intervalSeconds),
		canonicalCheckedAt: asString(canonicalProgress.checkedAt),
		canonicalAgeMs: asNumber(canonicalProgress.ageMs),
		canonicalError: asString(canonicalProgress.error),
		outerLastFinalIndex: asNumber(outer.lastFinalIndex),
		outerLastFinalBlockHeight: asNumber(outer.lastFinalBlockHeight),
		outerNonCanonicalTailCount: asNumber(outer.nonCanonicalTailCount),
		innerLastFinalIndex: asNumber(inner.lastFinalIndex),
		innerLastFinalBlockHeight: asNumber(inner.lastFinalBlockHeight),
		innerNonCanonicalTailCount: asNumber(inner.nonCanonicalTailCount)
	}
}

const prefixedCoverage = (
	prefix: "l1" | "l2",
	coverage: ServiceProbe["details"]
) =>
	Object.fromEntries(
		Object.entries(coverage).map(([key, value]) => [
			`${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`,
			value
		])
	)

const existingCoverageDetails = (
	snapshotValue: OpsSnapshot
): ServiceProbe["details"] => {
	const details =
		snapshotValue.services.find((service) => service.id === "actions-indexer")
			?.details ?? {}
	return Object.fromEntries(
		Object.entries(details).filter(([key]) =>
			/^l[12](ActionCoverage|MissingAction|FirstMissingAction|LatestArchiveAction|ActionScan)/.test(
				key
			)
		)
	)
}

const indexerToken = (network: OpsNetwork) =>
	$fetch<{ token: string }>("/api/ops/indexer-token", { query: { network } })

const actionCoverage = (
	network: OpsNetwork,
	lastFetchedOuter: number | null,
	lastFetchedInner: number | null
) =>
	$fetch<ActionCoverageSnapshot>("/api/ops/action-coverage", {
		query: {
			network,
			...(lastFetchedOuter !== null && { lastFetchedOuter }),
			...(lastFetchedInner !== null && { lastFetchedInner })
		}
	})

const fetchIndexerJson = async (url: string, token: string) => {
	const response = await fetch(url, {
		headers: { authorization: `Bearer ${token}` }
	})
	const payload = await response.json().catch(() => null)
	return { response, payload }
}

const hydrateIndexerFromBrowser = async (
	nextSnapshot: OpsSnapshot
): Promise<OpsSnapshot> => {
	const token = (await indexerToken(nextSnapshot.config.network)).token
	const endpoint = nextSnapshot.config.actionsIndexerUrl.replace(/\/+$/, "")
	const [health, status] = await Promise.all([
		fetchIndexerJson(`${endpoint}/health`, token),
		fetchIndexerJson(`${endpoint}/status`, token)
	])
	const details: ServiceProbe["details"] = {
		...directIndexerDetails(health.payload, status.payload),
		statusHttp: status.response.status
	}
	const scannedCoverage = await actionCoverage(
		nextSnapshot.config.network,
		asNumber(details.lastFetchedOuter),
		asNumber(details.lastFetchedInner)
	).catch(() => null)
	const withCoverage: ServiceProbe["details"] = {
		...details,
		...(scannedCoverage === null
			? existingCoverageDetails(nextSnapshot)
			: {
					...prefixedCoverage("l1", scannedCoverage.l1),
					...prefixedCoverage("l2", scannedCoverage.l2)
				})
	}
	const indexerStatus: ServiceStatus =
		health.response.ok &&
		asString(asRecord(health.payload).status) === "healthy"
			? status.response.ok
				? "ok"
				: "warn"
			: "error"
	const error = !health.response.ok
		? `Health check returned HTTP ${health.response.status}`
		: !status.response.ok
			? `Status check returned HTTP ${status.response.status}`
			: undefined
	const services = nextSnapshot.services.map((service): ServiceProbe => {
		if (service.id !== "actions-indexer") return service
		const { error: _previousError, ...serviceWithoutError } = service
		return {
			...serviceWithoutError,
			status: indexerStatus,
			checkedAt: new Date().toISOString(),
			latencyMs: null,
			httpStatus: health.response.status,
			details: withCoverage,
			...(error !== undefined && { error })
		}
	})
	return {
		...nextSnapshot,
		summary: summarizeStates(services.map((service) => service.status)),
		services
	}
}

const refresh = async ({ force = false }: { force?: boolean } = {}) => {
	if (isRefreshing.value && !force) return
	const sequence = ++refreshSequence
	const network = selectedNetwork.value
	isRefreshing.value = true
	errorMessage.value = null
	lastRefreshStartedAt.value = new Date().toISOString()
	try {
		const nextSnapshot = await $fetch<OpsSnapshot>("/api/ops/status", {
			query: { network }
		})
		const hydratedSnapshot = await hydrateIndexerFromBrowser(
			nextSnapshot
		).catch((error) => {
			errorMessage.value =
				error instanceof Error ? error.message : String(error)
			return nextSnapshot
		})
		if (sequence === refreshSequence && selectedNetwork.value === network) {
			snapshot.value = hydratedSnapshot
		}
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : String(error)
	} finally {
		if (sequence === refreshSequence) isRefreshing.value = false
	}
}

const runControl = async (action: ControlAction) => {
	const destructive = action === "rebuild" || action === "reset"
	if (
		destructive &&
		!window.confirm(`${action} ${selectedNetwork.value} actions indexer?`)
	)
		return

	activeAction.value = action
	actionMessage.value = null
	errorMessage.value = null
	try {
		const endpoint = snapshot.value?.config.actionsIndexerUrl.replace(
			/\/+$/,
			""
		)
		if (endpoint === undefined)
			throw new Error("Load an indexer snapshot before running controls.")
		const token = (await indexerToken(selectedNetwork.value)).token
		const response = await fetch(`${endpoint}/${action}`, {
			method: "POST",
			headers: { authorization: `Bearer ${token}` }
		})
		const result = (await response.json().catch(() => null)) as {
			message?: string
		} | null
		if (!response.ok)
			throw new Error(
				`${action} failed with HTTP ${response.status}: ${
					result?.message ?? response.statusText
				}`
			)
		actionMessage.value = result?.message ?? `${action} submitted`
		await refresh()
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : String(error)
	} finally {
		activeAction.value = null
	}
}

const switchNetwork = (network: OpsNetwork) => {
	if (resolveNetworkFromQuery(route.query.network) === network) return
	void router.replace({
		query: {
			...route.query,
			network
		}
	})
}

onMounted(() => {
	if (route.query.network !== selectedNetwork.value) {
		void router.replace({
			query: {
				...route.query,
				network: selectedNetwork.value
			}
		})
	}
	void refresh({ force: true })
	refreshTimer = setInterval(() => {
		if (document.visibilityState === "visible") void refresh()
	}, refreshIntervalMs)
})

onBeforeUnmount(() => {
	if (refreshTimer !== null) clearInterval(refreshTimer)
})

watch(
	() => route.query.network,
	(value) => {
		const network = resolveNetworkFromQuery(value)
		if (selectedNetwork.value === network) return
		selectedNetwork.value = network
		actionMessage.value = null
		void refresh({ force: true })
	}
)
</script>

<template>
  <main class="OpsShell">
    <header class="OpsHeader">
      <div>
        <p class="Kicker">Zeko infrastructure</p>
        <h1>Action Indexer Ops</h1>
      </div>
      <div class="HeaderStatus">
        <span class="NetworkPill">{{ currentNetwork }}</span>
        <span v-if="pendingNetwork" class="TransitionPill">
          Next {{ pendingNetwork }}
        </span>
        <span
          class="HealthPill"
          :data-state="indexerHeaderState">
          {{ indexerHeaderLabel }}
        </span>
        <span class="Timestamp">Checked {{
            formatDate(snapshot?.checkedAt)
          }}</span>
        <span class="LiveState" :data-active="!isRefreshing">
          {{ loadingLabel ?? `Live ${refreshIntervalMs / 1000}s` }}
        </span>
      </div>
    </header>

    <section class="ControlBar" aria-label="Actions indexer controls">
      <div class="NetworkTabs" aria-label="Network selector">
        <button
          type="button"
          :aria-pressed='selectedNetwork === "mainnet"'
          :data-active='selectedNetwork === "mainnet"'
          @click='switchNetwork("mainnet")'>
          Mainnet
        </button>
        <button
          type="button"
          :aria-pressed='selectedNetwork === "testnet"'
          :data-active='selectedNetwork === "testnet"'
          @click='switchNetwork("testnet")'>
          Testnet
        </button>
      </div>
      <button
        class="IconButton Primary"
        type="button"
        :disabled="isRefreshing"
        @click="() => refresh({ force: true })">
        <RefreshCcw :size="17" :class="{ Spinning: isRefreshing }" />
        Refresh
      </button>
      <button
        type="button"
        class="IconButton"
        :disabled="activeAction !== null"
        @click='runControl("start")'>
        <Play :size="16" />
        Start
      </button>
      <button
        type="button"
        class="IconButton"
        :disabled="activeAction !== null"
        @click='runControl("stop")'>
        <Square :size="15" />
        Stop
      </button>
      <button
        type="button"
        class="IconButton Warn"
        :disabled="activeAction !== null"
        @click='runControl("rebuild")'>
        <RotateCcw :size="16" />
        Rebuild
      </button>
      <button
        type="button"
        class="IconButton Danger"
        :disabled="activeAction !== null"
        @click='runControl("reset")'>
        <Zap :size="16" />
        Resync
      </button>
      <span v-if="activeAction" class="ActionState">{{ activeAction }}
        running on {{ selectedNetwork }}</span>
      <span v-else class="ActionState">
        Last requested {{ formatDate(lastRefreshStartedAt) }}
      </span>
    </section>

    <p v-if="actionMessage" class="Notice">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="Notice Error">{{ errorMessage }}</p>

    <p class="ControlNote">
      Rebuild repopulates indexed rows from the archive sources and resumes from
      the rebuilt heads; resync/reset clears indexed state and starts indexing
      again from scratch.
    </p>

    <section class="SummaryGrid" aria-label="Status summary">
      <div class="Metric">
        <span>OK</span>
        <strong>{{ displayedSummary.ok }}</strong>
      </div>
      <div class="Metric">
        <span>Warn</span>
        <strong>{{ displayedSummary.warn }}</strong>
      </div>
      <div class="Metric">
        <span>Error</span>
        <strong>{{ displayedSummary.error }}</strong>
      </div>
      <div class="Metric">
        <span>Unknown</span>
        <strong>{{ displayedSummary.unknown }}</strong>
      </div>
    </section>

    <section class="InsightGrid" aria-label="Operational gaps">
      <article
        v-for="row in chainRows"
        :key="`${row.id}-coverage`"
        class="InsightCard"
        :data-state="coverageState(row)">
        <span>{{ row.indexerLabel }} archive coverage</span>
        <strong>{{ coverageLabel(row) }}</strong>
        <small>{{ coverageDetail(row) }}</small>
      </article>
      <article
        v-for="row in chainRows"
        :key="`${row.id}-pending-actions`"
        class="InsightCard"
        :data-state="tailState(row.nonCanonicalTailCount, row.expectedFinalityBlocks)">
        <span>{{ row.indexerLabel }} actions in DB awaiting finality</span>
        <strong>{{ pendingActionLabel(row) }}</strong>
        <small>final action block {{
            formatBlock(row.finalActionBlockHeight)
          }}</small>
      </article>
      <article
        v-for="row in chainRows"
        :key="`${row.id}-daemon-gap`"
        class="InsightCard"
        :data-state='
          row.daemonBlockHeightSupported
          ? gapState(row.archiveDaemonGap)
          : "ok"
        '>
        <span>{{ row.label }} archive / daemon</span>
        <strong>{{ archiveDaemonSummary(row) }}</strong>
        <small v-if="row.daemonBlockHeightSupported">Archive {{
            formatBlock(row.archiveHeight)
          }} vs daemon {{ formatBlock(row.daemonHeight) }}</small>
        <small v-else>One L2 block is one transaction; no daemon block
          head.</small>
      </article>
    </section>

    <section class="IndexerSection" aria-label="Actions indexer status">
      <article
        v-if="indexerService"
        class="ServiceCard IndexerCard"
        :data-state="indexerService.status">
        <header class="ServiceHeader">
          <component :is="serviceIcon(indexerService)" :size="19" />
          <div>
            <h2>{{ indexerService.label }}</h2>
            <p>{{ indexerService.endpoint }}</p>
          </div>
          <span class="StateBadge" :data-state="indexerService.status">{{
            indexerService.status
          }}</span>
        </header>

        <div class="IndexerHighlights">
          <div v-for="row in chainRows" :key="`${row.id}-indexer`">
            <span>{{ row.indexerLabel }} archive coverage</span>
            <strong>{{ coverageLabel(row) }}</strong>
            <small :data-state="coverageState(row)">{{
              coverageDetail(row)
            }}</small>
          </div>
          <div>
            <span>DB</span>
            <strong>{{
              formatValue(detailValue(indexerService, "databaseStatus"))
            }}</strong>
            <small>{{ indexerDbAgeSeconds ?? "-" }}s status age; {{
                formatValue(
                	detailValue(indexerService, "databaseLatencyMs")
                )
              }} ms latency</small>
          </div>
          <div>
            <span>Indexer loop</span>
            <strong>{{
              formatValue(detailValue(indexerService, "running"))
            }}</strong>
            <small>{{
                formatValue(
                	detailValue(indexerService, "consecutiveErrors")
                )
              }} consecutive errors</small>
          </div>
        </div>

        <p v-if="indexerService.error" class="ServiceError">
          {{ indexerService.error }}
        </p>
      </article>
    </section>

    <section class="ChainGrid" aria-label="Archive and daemon alignment">
      <section v-for="row in chainRows" :key="row.id" class="ChainBand">
        <header class="ChainHeader">
          <div>
            <p class="Kicker">
              Zeko action-indexer {{ row.indexerLabel }} actions
            </p>
            <h2>{{ row.label }}</h2>
          </div>
          <div class="ChainBadges">
            <span
              :data-state="
                finalityState(
                	row.archiveFinalityGap,
                	row.expectedFinalityBlocks
                )
              ">
              {{ finalityGapLabel(row) }}
            </span>
            <span :data-state="coverageState(row)">
              {{ coverageLabel(row) }}
            </span>
            <span
              :data-state='
                row.daemonBlockHeightSupported
                ? gapState(row.archiveDaemonGap)
                : "ok"
              '>
              {{ archiveDaemonSummary(row) }}
            </span>
          </div>
        </header>

        <div class="HeightStrip">
          <div>
            <span>DB latest action block</span>
            <strong>{{ formatBlock(row.lastActionBlockHeight) }}</strong>
            <small>final action block {{
                formatBlock(row.finalActionBlockHeight)
              }}</small>
          </div>
          <div>
            <span>Archive head</span>
            <strong>{{ formatBlock(row.archiveHeight) }}</strong>
            <small>{{ coverageDetail(row) }}</small>
          </div>
          <div v-if="row.daemonBlockHeightSupported">
            <span>Daemon head</span>
            <strong>{{ formatBlock(row.daemonHeight) }}</strong>
            <small>{{ archiveDaemonGapLabel(row.archiveDaemonGap) }}</small>
          </div>
          <div v-else>
            <span>L2 block model</span>
            <strong>1 tx</strong>
            <small>One block is one transaction; daemon head is not
              exposed.</small>
          </div>
        </div>

        <div class="LaneColumns">
          <article
            v-for="service in rowServices(row)"
            :key="service.id"
            class="ServiceCard"
            :data-state="service.status">
            <header class="ServiceHeader">
              <component :is="serviceIcon(service)" :size="19" />
              <div>
                <h2>{{ service.label }}</h2>
                <p>{{ service.endpoint }}</p>
              </div>
              <span class="StateBadge" :data-state="service.status">{{
                service.status
              }}</span>
            </header>

            <dl class="DetailGrid Compact">
              <div>
                <dt>HTTP</dt>
                <dd>{{ service.httpStatus ?? "-" }}</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>
                  {{
                    service.latencyMs === null
                    ? "-"
                    : `${service.latencyMs} ms`
                  }}
                </dd>
              </div>
              <div>
                <dt>Checked</dt>
                <dd>{{ formatDate(service.checkedAt) }}</dd>
              </div>
              <div v-for="entry in detailEntries(service)" :key="entry.key">
                <dt>{{ entry.label }}</dt>
                <dd>{{ formatValue(entry.value) }}</dd>
              </div>
            </dl>

            <p v-if="service.error" class="ServiceError">{{ service.error }}</p>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>
