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
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

type ServiceStatus = "ok" | "warn" | "error" | "unknown"
type ServiceKind = "actions-indexer" | "archive" | "daemon"

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
	summary: Record<ServiceStatus, number>
	services: ServiceProbe[]
}

type ControlAction = "start" | "stop" | "rebuild" | "reset"

const snapshot = ref<OpsSnapshot | null>(null)
const isRefreshing = ref(false)
const activeAction = ref<ControlAction | null>(null)
const errorMessage = ref<string | null>(null)
const actionMessage = ref<string | null>(null)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const serviceIcon = (service: ServiceProbe) => {
	if (service.kind === "actions-indexer") return Activity
	if (service.kind === "archive") return Database
	return Server
}

const services = computed(() => snapshot.value?.services ?? [])
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

const detailEntries = (service: ServiceProbe) =>
	Object.entries(service.details).filter(
		([, value]) => value !== null && value !== ""
	)

const refresh = async () => {
	isRefreshing.value = true
	errorMessage.value = null
	try {
		snapshot.value = await $fetch<OpsSnapshot>("/api/ops/status")
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : String(error)
	} finally {
		isRefreshing.value = false
	}
}

const runControl = async (action: ControlAction) => {
	const destructive = action === "rebuild" || action === "reset"
	if (destructive && !window.confirm(`${action} actions indexer?`)) return

	activeAction.value = action
	actionMessage.value = null
	errorMessage.value = null
	try {
		const result = await $fetch<{
			message?: string
			result?: { message?: string }
		}>("/api/ops/control", {
			method: "POST",
			body: { action }
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

onMounted(() => {
	void refresh()
	refreshTimer = setInterval(() => {
		if (document.visibilityState === "visible") void refresh()
	}, 15_000)
})

onBeforeUnmount(() => {
	if (refreshTimer !== null) clearInterval(refreshTimer)
})
</script>

<template>
  <main class="OpsShell">
    <header class="OpsHeader">
      <div>
        <p class="Kicker">Zeko infrastructure</p>
        <h1>Actions Ops</h1>
      </div>
      <div class="HeaderStatus">
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
      </div>
    </header>

    <section class="ControlBar" aria-label="Actions indexer controls">
      <button
        class="IconButton Primary"
        type="button"
        :disabled="isRefreshing"
        @click="refresh">
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
        running</span>
    </section>

    <p v-if="actionMessage" class="Notice">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="Notice Error">{{ errorMessage }}</p>

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

    <section class="ServiceGrid" aria-label="Service status">
      <article
        v-for="service in services"
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

        <dl class="DetailGrid">
          <div>
            <dt>HTTP</dt>
            <dd>{{ service.httpStatus ?? "-" }}</dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>
              {{ service.latencyMs === null ? "-" : `${service.latencyMs} ms` }}
            </dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>{{ formatDate(service.checkedAt) }}</dd>
          </div>
          <div v-for="([key, value]) in detailEntries(service)" :key>
            <dt>{{ key }}</dt>
            <dd>{{ formatValue(value) }}</dd>
          </div>
        </dl>

        <p v-if="service.error" class="ServiceError">{{ service.error }}</p>
      </article>
    </section>
  </main>
</template>
