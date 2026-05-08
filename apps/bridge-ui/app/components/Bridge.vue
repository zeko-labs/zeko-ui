<script lang="ts" setup>
import { Settings } from "lucide-vue-next"
import { useSelector } from "~~/machines/vue-xstate"
import { selectBridgeOperationView } from "./bridgeOperationView"

const bs = useBridgeStore()
const isSettingsOpen = ref(false)

const operationView = useSelector(bs.bridge.actorRef, (state) =>
	selectBridgeOperationView({
		operations: state.context.operations,
		activeOperation: state.context.activeOperation
	})
)
const completedOperations = computed(
	() => operationView.value.completedOperations
)

const currentOperation = computed(() => operationView.value.currentOperation)

const queuedOperations = computed(() => operationView.value.queuedOperations)
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
    <!-- <pre>{{  allOperations }}</pre> -->
    <div v-if="queuedOperations.length > 0" class="NextTransactions">
      <!-- <h3>Next Transactions</h3> -->
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
