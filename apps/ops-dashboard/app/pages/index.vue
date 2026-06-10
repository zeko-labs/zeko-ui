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
	actionGapState,
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
	}
	summary: Record<ServiceStatus, number>
	services: ServiceProbe[]
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
const refreshIntervalMs = 5_000
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
				label: "L1 Mina",
				indexerLabel: "Outer",
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
				label: "L2 Zeko",
				indexerLabel: "Inner",
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
const unhealthyCount = computed(
	() =>
		services.value.filter(
			(service) => service.status === "error" || service.status === "warn"
		).length
)

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
const actionGapLabel = (row: ChainRow) => {
	if (row.canonicalActionGap === null) return "unavailable"
	if (row.canonicalActionGap === 0) return "aligned"
	if (row.canonicalActionGap < 0)
		return `${Math.abs(row.canonicalActionGap).toLocaleString()} ahead of canonical archive`
	const unit = row.id === "l2" ? "txs" : "blocks"
	return `${row.canonicalActionGap.toLocaleString()} ${unit} since final action`
}
const finalityGapLabel = (row: ChainRow) => {
	if (row.archiveFinalityGap === null) return "pending/canonical unknown"
	const gap = row.archiveFinalityGap.toLocaleString()
	if (row.expectedFinalityBlocks === null) return `${gap} pending txs`
	return `${gap} pending blocks`
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
		if (sequence === refreshSequence && selectedNetwork.value === network) {
			snapshot.value = nextSnapshot
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
		const result = await $fetch<{
			message?: string
			result?: { message?: string }
		}>("/api/ops/control", {
			method: "POST",
			body: { action, network: selectedNetwork.value }
		})
		actionMessage.value =
			result.result?.message ?? result.message ?? `${action} submitted`
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
		snapshot.value = null
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
        <span
          class="HealthPill"
          :data-state='unhealthyCount === 0 ? "ok" : "warn"'>
          {{
            unhealthyCount === 0
            ? "All clear"
            : `${unhealthyCount} attention`
          }}
        </span>
        <span class="Timestamp">Checked {{
            formatDate(snapshot?.checkedAt)
          }}</span>
        <span class="LiveState" :data-active="!isRefreshing">
          Live {{ refreshIntervalMs / 1000 }}s
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
        <strong>{{ snapshot?.summary.ok ?? 0 }}</strong>
      </div>
      <div class="Metric">
        <span>Warn</span>
        <strong>{{ snapshot?.summary.warn ?? 0 }}</strong>
      </div>
      <div class="Metric">
        <span>Error</span>
        <strong>{{ snapshot?.summary.error ?? 0 }}</strong>
      </div>
      <div class="Metric">
        <span>Unknown</span>
        <strong>{{ snapshot?.summary.unknown ?? 0 }}</strong>
      </div>
    </section>

    <section class="InsightGrid" aria-label="Operational gaps">
      <article
        v-for="row in chainRows"
        :key="`${row.id}-finality-gap`"
        class="InsightCard"
        :data-state="finalityState(row.archiveFinalityGap, row.expectedFinalityBlocks)">
        <span>{{ row.label }} finality window</span>
        <strong>{{ finalityGapLabel(row) }}</strong>
        <small>Pending {{ formatBlock(row.archiveHeight) }} vs canonical {{
            formatBlock(row.archiveCanonicalHeight)
          }}</small>
      </article>
      <article
        v-for="row in chainRows"
        :key="`${row.id}-action-gap`"
        class="InsightCard"
        :data-state="actionGapState(row.canonicalActionGap)">
        <span>Zeko action-indexer {{ row.indexerLabel }} stream</span>
        <strong>{{ actionGapLabel(row) }}</strong>
        <small>Final action block {{ formatBlock(row.finalActionBlockHeight) }}
          vs canonical {{ formatBlock(row.archiveCanonicalHeight) }}</small>
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
            <span>{{ row.indexerLabel }} last action block</span>
            <strong>{{ formatBlock(row.lastActionBlockHeight) }}</strong>
            <small :data-state="actionGapState(row.canonicalActionGap)">
              final {{ formatBlock(row.finalActionBlockHeight) }}; tail {{
                formatBlock(row.nonCanonicalTailCount)
              }}
            </small>
          </div>
          <div>
            <span>DB</span>
            <strong>{{
              formatValue(detailValue(indexerService, "databaseStatus"))
            }}</strong>
            <small>{{
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
                formatValue(detailValue(indexerService, "intervalSeconds"))
              }}s interval</small>
          </div>
        </div>

        <dl class="DetailGrid">
          <div>
            <dt>HTTP</dt>
            <dd>{{ indexerService.httpStatus ?? "-" }}</dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>
              {{
                indexerService.latencyMs === null
                ? "-"
                : `${indexerService.latencyMs} ms`
              }}
            </dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>{{ formatDate(indexerService.checkedAt) }}</dd>
          </div>
          <div
            v-for="entry in detailEntries(indexerService)"
            :key="entry.key"
            :data-database="entry.isDatabase">
            <dt>{{ entry.label }}</dt>
            <dd>{{ formatValue(entry.value) }}</dd>
          </div>
        </dl>

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
              Zeko action-indexer {{ row.indexerLabel }} stream
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
            <span
              :data-state="
                tailState(
                	row.nonCanonicalTailCount,
                	row.expectedFinalityBlocks
                )
              ">
              non-canonical tail {{ formatBlock(row.nonCanonicalTailCount) }}
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
            <span>Last action block</span>
            <strong>{{ formatBlock(row.lastActionBlockHeight) }}</strong>
            <small>final action block {{
                formatBlock(row.finalActionBlockHeight)
              }}</small>
          </div>
          <div>
            <span>Archive pending</span>
            <strong>{{ formatBlock(row.archiveHeight) }}</strong>
            <small>canonical {{
                formatBlock(row.archiveCanonicalHeight)
              }}</small>
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
