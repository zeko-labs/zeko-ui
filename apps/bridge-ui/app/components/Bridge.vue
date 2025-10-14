<script lang="ts" setup>
import { useSelector } from "~~/machines/vue-xstate"

const bs = useBridgeStore()

const allOperations = useSelector(bs.bridge.actorRef, (state) =>
	Object.groupBy(
		[...state.context.operations.values()].map(({ operation, status }) => ({
			id: operation.id,
			status,
			operation
		})),
		({ status }) => (status === "completed" ? "complete" : "uncomplete")
	)
)
const completedOperations = computed(() => allOperations.value.complete ?? [])

const currentOperation = computed(
	() => allOperations.value.uncomplete?.[0]?.operation
)

const queuedOperations = computed(
	() =>
		allOperations.value.uncomplete
			?.slice(1)
			.map(({ operation }) => operation) ?? []
	// Array.from({ length: 10 }).map(
	// 	() =>
	// 		useMachine(bridgeOperationMachine, {
	// 			input: {
	// 				bridgeMachine: bs.bridge.actorRef,
	// 				wallet: bs.wallet.actorRef,
	// 				amount: "10",
	// 				direction: "withdrawal",
	// 				source: "zeko:testnet",
	// 				destination: "mina:devnet"
	// 			}
	// 		}).actorRef
	// )
)
</script>
<template>
  <div class="Bridge">
    <div class="MainOperation">
      <Inputs v-if="!currentOperation" />
      <CurrentOperation v-else :operation="currentOperation" />
    </div>
    <!-- <pre>{{  allOperations }}</pre> -->
    <div v-if="queuedOperations.length > 0" class="NextTransactions">
      <!-- <h3>Next Transactions</h3> -->
      <div class="QueuedOperations">
        <QueuedOperation
          v-for="(operation, index) of queuedOperations"
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
  @media (max-width: 1024px) {
    grid-template-columns: auto;
    gap: 2rem;
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
