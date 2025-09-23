<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"

const bs = useBridgeStore()

const amountToBridge = ref<number | undefined>(undefined)

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

const startBridge = () => {
	const amount = (amountToBridge.value ?? 0).toString()
	bs.bridge.send({ type: "StartOperation", amount })
	amountToBridge.value = undefined
}
</script>
<template>
  <Disabled
    v-if='
      bs.wallet.snapshot.matches("UNSUPPORTED") ||
      bs.currentNetwork.includes("mainnet") ||
      bs.wallet.snapshot.error ||
      (bs.address.length === 0 && bs.wallet.snapshot.matches("INIT"))
    '
  />
  <div
    class="Bridge"
    v-else-if='bs.bridge.snapshot.matches("READY")'>
    <div class="MainOperation">
      <div class="MainOperationInput" v-if="!currentOperation">
        <div class="InputBox">
          <h4>Sending</h4>
          <BridgeAmountSelector v-model="amountToBridge" />
        </div>

        <FromTo
          :source="bs.bridge.snapshot.context.sourceNetwork"
          :destination="bs.bridge.snapshot.context.destinationNetwork"
        />
        <Button
          class="BridgeButton"
          variant="cta2"
          @click="startBridge"
          :disabled="!amountToBridge || amountToBridge <= 0 || bs.address.length === 0">
          Send
        </Button>
      </div>
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
      <AnimatedLoadingSpinner
        class="Spinner"
        v-if='bs.bridge.snapshot.matches("FIND_OPERATIONS")'
      />
      <template v-else>
        <h3>Completed Transactions</h3>
        <BridgeOperations :operations="completedOperations" />
      </template>
    </div>
  </div>

  <AnimatedLoadingSpinner class="BigSpinner" v-else />

  <CurrentErrors v-if="currentOperation" :operation="currentOperation" />
</template>
<style lang="postcss" scoped>
:deep(.InputBox) {
  display: grid;
  grid-template-columns: 20ch 1fr;
  align-items: center;
  @media (max-width: 1024px) {
    grid-template-columns: 10ch 1fr;
  }
}
.MainOperation {
  display: grid;
  grid-template-columns: auto;
  margin: auto;
  max-width: 60rem;
  @media (max-width: 1024px) {
    grid-template-columns: auto;
    grid-template-rows: auto auto;
    gap: 2rem;
  }
}
.MainOperationInput {
  display: grid;
  gap: 1rem;
  border-radius: 1rem;
  background: oklch(1 0 0 / 0.6);
  padding: 2rem;
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

.BigSpinner {
  place-self: center;
  --size: 40rem;
  height: auto;
  width: var(--size);
}
</style>
