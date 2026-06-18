<script lang="ts" setup>
import {
	AlertTriangle,
	Bug,
	ChevronsRight,
	Download,
	Plus,
	RotateCcw,
	Trash2,
	Zap
} from "lucide-vue-next"
import type { BridgeDebugBackendScenario } from "~~/machines/mockBackend"

const bs = useBridgeStore()
const debug = useBridgeDebugBackend()
const selectedScenario = ref(debug.snapshot.value.scenario)
const exportedSnapshot = ref("")

watch(
	() => debug.snapshot.value.scenario,
	(scenario) => {
		selectedScenario.value = scenario
	}
)

const stringifyState = (value: unknown) =>
	typeof value === "string" ? value : JSON.stringify(value)

const operations = computed(() =>
	[...bs.bridge.snapshot.context.operations.entries()].map(([id, entry]) => {
		const snapshot = entry.operation.getSnapshot()
		return {
			id,
			order: entry.order,
			status: entry.status,
			lane: entry.lane,
			state: stringifyState(snapshot.value),
			direction: snapshot.context.direction,
			transaction: snapshot.context.transaction?.hash ?? "none",
			canCancel: snapshot.context.canCancel
		}
	})
)

const activeState = computed(() => ({
	wallet: bs.address || "not connected",
	network: bs.currentNetwork,
	source: bs.bridge.snapshot.context.sourceNetwork,
	destination: bs.bridge.snapshot.context.destinationNetwork,
	activeOperation: bs.bridge.snapshot.context.activeOperation ?? "none",
	activeCancellationOperation:
		bs.bridge.snapshot.context.activeCancellationOperation ?? "none",
	currentSlot: debug.snapshot.value.currentSlot
}))

const setScenario = () => {
	debug.setScenario(selectedScenario.value as BridgeDebugBackendScenario)
}

const exportSnapshot = async () => {
	const snapshot = debug.exportSnapshot()
	exportedSnapshot.value = snapshot
	try {
		await navigator.clipboard?.writeText(snapshot)
	} catch {
		// Clipboard support is optional for this debug-only control.
	}
}
</script>

<template>
  <aside class="BridgeDebugPanel" aria-label="Bridge debug panel">
    <header class="DebugHeader">
      <div>
        <Bug class="DebugIcon" />
        <h3>Debug Backend</h3>
      </div>
      <span>{{ debug.snapshot.value.scenario }}</span>
    </header>

    <section class="DebugSection ScenarioSection">
      <label for="bridge-debug-scenario">Scenario</label>
      <select
        id="bridge-debug-scenario"
        v-model="selectedScenario"
        @change="setScenario">
        <option
          v-for="scenario in debug.scenarios"
          :key="scenario"
          :value="scenario">
          {{ scenario }}
        </option>
      </select>
    </section>

    <section class="DebugSection ControlsSection">
      <button
        type="button"
        title="Reset mock backend state"
        @click="debug.reset">
        <RotateCcw /> Reset
      </button>
      <button
        type="button"
        title="Seed recovered deposit"
        @click='debug.seedRecoveredOperation("deposit")'>
        <Plus /> Seed Deposit
      </button>
      <button
        type="button"
        title="Seed recovered withdrawal"
        @click='debug.seedRecoveredOperation("withdrawal")'>
        <Plus /> Seed Withdrawal
      </button>
      <button
        type="button"
        title="Advance pending backend status"
        @click="debug.advancePendingStatus">
        <ChevronsRight /> Advance
      </button>
      <button
        type="button"
        title="Force the next completion to return a fee-too-low error"
        @click='debug.forceNextError("fee-too-low")'>
        <Zap /> Fee Retry
      </button>
      <button
        type="button"
        title="Force the next worker call to fail terminally"
        @click='debug.forceNextError("terminal")'>
        <AlertTriangle /> Terminal Error
      </button>
      <button
        type="button"
        title="Force the next worker call to fail transiently"
        @click='debug.forceNextError("transient")'>
        <AlertTriangle /> Transient Error
      </button>
      <button
        type="button"
        title="Toggle the first seeded deposit cancellability"
        @click="debug.toggleCancellableDeposit">
        <Zap /> Cancellable
      </button>
      <button
        type="button"
        title="Clear mock backend logs"
        @click="debug.clearLogs">
        <Trash2 /> Clear Logs
      </button>
      <button
        type="button"
        title="Export debug snapshot JSON"
        @click="exportSnapshot">
        <Download /> Export
      </button>
    </section>

    <section class="DebugSection StateGrid">
      <dl>
        <div v-for="(value, key) in activeState" :key>
          <dt>{{ key }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
    </section>

    <section class="DebugSection">
      <h4>Operations</h4>
      <div class="DebugTable">
        <div class="DebugRow DebugRowHeader">
          <span>ID</span>
          <span>Lane</span>
          <span>Status</span>
          <span>State</span>
          <span>Hash</span>
        </div>
        <div
          v-for="operation in operations"
          :key="operation.id"
          class="DebugRow">
          <span>{{ operation.id }}</span>
          <span>{{ operation.lane }}</span>
          <span>{{ operation.status }}</span>
          <span>{{ operation.state }}</span>
          <span>{{ operation.transaction }}</span>
        </div>
        <p v-if="operations.length === 0">No operation actors.</p>
      </div>
    </section>

    <section class="DebugSection">
      <h4>Mock Backend</h4>
      <dl class="CompactList">
        <div>
          <dt>forcedError</dt>
          <dd>{{ debug.snapshot.value.forcedError ?? "none" }}</dd>
        </div>
        <div>
          <dt>signatureRequests</dt>
          <dd>{{ debug.snapshot.value.signatureRequests.length }}</dd>
        </div>
        <div>
          <dt>seededOperations</dt>
          <dd>{{ debug.snapshot.value.seededOperations.length }}</dd>
        </div>
      </dl>
    </section>

    <section class="DebugSection">
      <h4>Signature Requests</h4>
      <ol class="DebugList">
        <li
          v-for="request in debug.snapshot.value.signatureRequests.slice(-6).reverse()"
          :key="request.requestId">
          <strong>{{ request.action }}</strong>
          <span>{{ request.requestId }}</span>
          <span>{{
            request.completed ? request.hash : "waiting for signature"
          }}</span>
        </li>
      </ol>
      <p v-if="debug.snapshot.value.signatureRequests.length === 0">
        No signature requests.
      </p>
    </section>

    <section class="DebugSection">
      <h4>Worker Calls</h4>
      <ol class="DebugList">
        <li
          v-for="call in debug.snapshot.value.calls.slice(-8).reverse()"
          :key="call.id">
          <strong>{{ call.method }}</strong>
          <span>#{{ call.id }}</span>
          <span>{{ call.error ?? "ok" }}</span>
        </li>
      </ol>
      <p v-if="debug.snapshot.value.calls.length === 0">No worker calls.</p>
    </section>

    <section v-if="exportedSnapshot" class="DebugSection ExportSection">
      <h4>Export</h4>
      <textarea readonly :value="exportedSnapshot" />
    </section>
  </aside>
</template>

<style lang="postcss" scoped>
.BridgeDebugPanel {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 120;
  display: grid;
  gap: 0.75rem;
  width: min(28rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow: auto;
  padding: 1rem;
  color: oklch(0.97 0.01 94);
  background: oklch(0.18 0.02 245 / 0.96);
  border: 1px solid oklch(0.72 0.12 92 / 0.55);
  border-radius: 0.5rem;
  box-shadow: 0 1rem 3rem oklch(0 0 0 / 0.35);
}

.DebugHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  span {
    font-size: 0.75rem;
    color: oklch(0.84 0.12 92);
  }
}

.DebugIcon {
  width: 1.1rem;
  height: 1.1rem;
}

.DebugSection {
  display: grid;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid oklch(0.9 0.01 94 / 0.18);

  h4 {
    margin: 0;
    font-size: 0.8rem;
    color: oklch(0.84 0.12 92);
    text-transform: uppercase;
  }

  p {
    margin: 0;
    color: oklch(0.79 0.02 245);
    font-size: 0.8rem;
  }
}

.ScenarioSection {
  grid-template-columns: auto 1fr;
  align-items: center;

  label {
    font-size: 0.8rem;
    color: oklch(0.79 0.02 245);
  }

  select {
    min-width: 0;
    padding: 0.45rem 0.5rem;
    color: inherit;
    background: oklch(0.13 0.02 245);
    border: 1px solid oklch(0.72 0.12 92 / 0.45);
    border-radius: 0.35rem;
  }
}

.ControlsSection {
  grid-template-columns: repeat(2, minmax(0, 1fr));

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 2rem;
    padding: 0.4rem 0.5rem;
    color: oklch(0.97 0.01 94);
    background: oklch(0.26 0.04 245);
    border: 1px solid oklch(0.9 0.01 94 / 0.16);
    border-radius: 0.35rem;
    cursor: pointer;
    font-size: 0.75rem;

    &:hover {
      border-color: oklch(0.72 0.12 92 / 0.8);
    }

    svg {
      width: 0.95rem;
      height: 0.95rem;
    }
  }
}

.StateGrid dl,
.CompactList {
  display: grid;
  gap: 0.35rem;
  margin: 0;

  div {
    display: grid;
    grid-template-columns: 12ch minmax(0, 1fr);
    gap: 0.5rem;
  }

  dt {
    color: oklch(0.79 0.02 245);
    font-size: 0.75rem;
  }

  dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
  }
}

.DebugTable {
  display: grid;
  gap: 0.25rem;
}

.DebugRow {
  display: grid;
  grid-template-columns: minmax(7rem, 1.4fr) 0.7fr 0.8fr 1fr 1fr;
  gap: 0.35rem;
  align-items: center;
  min-width: 34rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.7rem;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.DebugRowHeader {
  color: oklch(0.84 0.12 92);
  font-family: inherit;
  text-transform: uppercase;
}

.DebugList {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1rem;

  li {
    display: grid;
    grid-template-columns: minmax(8rem, 1fr) minmax(5rem, auto) minmax(0, 1fr);
    gap: 0.5rem;
    align-items: center;
    font-size: 0.72rem;
  }

  span {
    min-width: 0;
    overflow-wrap: anywhere;
    color: oklch(0.79 0.02 245);
  }
}

.ExportSection textarea {
  width: 100%;
  min-height: 8rem;
  color: oklch(0.97 0.01 94);
  background: oklch(0.13 0.02 245);
  border: 1px solid oklch(0.9 0.01 94 / 0.16);
  border-radius: 0.35rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
}
</style>
