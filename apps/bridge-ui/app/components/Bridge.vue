<script lang="ts" setup>
import { Settings } from "lucide-vue-next"
import type { ActorRefFromLogic } from "xstate"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import { useSelector } from "~~/machines/vue-xstate"

const bs = useBridgeStore()
const isSettingsOpen = ref(false)

type OperationCard = {
	id: string
	status: "started" | "paused" | "completed"
	lane: "main" | "cancellation"
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}

const allOperations = useSelector(bs.bridge.actorRef, (state) => {
	const items: OperationCard[] = [...state.context.operations.values()].map(
		({ operation, status, lane }) => ({
			id: operation.id,
			status,
			lane,
			operation
		})
	)

	const completed = items.filter((item) => item.status === "completed")
	const mainPending = items.filter(
		(item) => item.status !== "completed" && item.lane === "main"
	)
	const cancellationPending = items.filter(
		(item) => item.status !== "completed" && item.lane === "cancellation"
	)

	return {
		completed,
		currentMainOperation:
			mainPending.find((item) => item.status === "started")?.operation ?? null,
		queuedMainOperations: mainPending
			.filter((item) => item.status !== "started")
			.map(({ operation }) => operation),
		cancellableOperations: cancellationPending.map(
			({ operation }) => operation
		),
		activeCancellationOperation: state.context.activeCancellationOperation
	}
})

const completedOperations = computed(() => allOperations.value.completed ?? [])

const currentOperation = computed(
	() => allOperations.value.currentMainOperation
)

const queuedOperations = computed(
	() => allOperations.value.queuedMainOperations ?? []
)

const cancellableOperations = computed(
	() => allOperations.value.cancellableOperations ?? []
)

const activeCancellationOperation = computed(
	() => allOperations.value.activeCancellationOperation
)
</script>
<template>
  <div class="Bridge">
    <div class="MainOperation">
      <button
        type="button"
        class="SettingsButton"
        title="Bridge Settings"
        @click="(isSettingsOpen = true)">
        <Settings />
      </button>
      <BridgeSettings
        :isOpen="isSettingsOpen"
        @close="(isSettingsOpen = false)"
      />
      <Inputs v-if="!currentOperation" />
      <CurrentOperation v-else :operation="currentOperation" />
    </div>
    <div
      v-if="cancellableOperations.length > 0"
      class="CancellableTransactions">
      <h3>Cancellable Deposits</h3>
      <div class="QueuedOperations">
        <CancellableOperation
          v-for="(operation, index) in cancellableOperations"
          :operation
          :index
          :disabled="
            activeCancellationOperation !== null &&
            activeCancellationOperation !== operation.id
          "
        />
      </div>
      <h4>
        These deposits can be cancelled separately without blocking new bridge
        requests.
      </h4>
    </div>
    <div v-if="queuedOperations.length > 0" class="NextTransactions">
      <h3>Next Transactions</h3>
      <div class="QueuedOperations">
        <QueuedOperation
          v-for="(operation, index) in queuedOperations"
          :operation
          :index
        />
      </div>
      <h4>
        You will be able to complete these transactions once the current
        transaction is completed.
      </h4>
    </div>
    <div class="CompletedTransactions">
      <h3>Completed Transactions</h3>
      <BridgeOperations :operations="completedOperations" />
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.MainOperation {
  display: grid;
  grid-template-columns: auto;
  margin: auto;
  max-width: 50rem;
  position: relative;
  @media (max-width: 1024px) {
    grid-template-columns: auto;
    gap: 2rem;
  }

  .SettingsButton {
    position: absolute;
    top: -2.5rem;
    right: 0rem;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    color: var(--palette-gray-600);
    transition: all 0.2s;

    &:hover {
      background: var(--palette-gray-200);
      color: var(--palette-gray-800);
    }
  }
}

.CancellableTransactions,
.NextTransactions {
  margin-top: 2rem;
  h4 {
    font-style: italic;
  }
  .QueuedOperations {
    display: flex;
    gap: 3ch;
    max-width: calc(100vw - 2 * var(--page-padding, 0));
    overflow-y: scroll;
    padding: 1rem 0;
  }
}

.CompletedTransactions {
  display: grid;
  &:has(.Spinner) {
    place-items: center;
  }
  .Spinner {
    --size: 25rem;
    height: auto;
    width: var(--size);
  }
}
</style>
