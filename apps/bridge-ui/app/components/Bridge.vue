<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"

const bs = useBridgeStore()

const amountToBridge = ref<number | undefined>(undefined)

const allOperations = useSelector(bs.bridge.actorRef, (state) =>
	[...state.context.operations.entries()].map(([id, value]) => ({
		id,
		operation: value.operation
	}))
)

const firstOperation = computed(() => allOperations.value[0]?.operation)
const otherOperations = computed(() => allOperations.value.slice(1))
</script>
<template>
  <Disabled
    v-if='
      bs.currentNetwork.includes("mainnet") ||
      (bs.address.length === 0 && !bs.bridge.snapshot.matches("IDLE"))
    '
  />
  <div
    class="Bridge"
    v-else-if='!bs.currentNetwork.includes("mainnet") && bs.address.length > 0'>
    <div class="MainOperation" :class="{ NoOperation: !firstOperation }">
      <div class="MainOperationInput">
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
          @click='
            bs.bridge.send({
            	type: "StartOperation",
            	amount: (amountToBridge ?? 0).toString()
            })
          '
          :disabled="!amountToBridge || amountToBridge <= 0">
          Bridge
        </Button>
      </div>
      <CurrentOperation v-if="firstOperation" :operation="firstOperation" />
    </div>
    <div class="RecentTransactions">
      <h3>Recent Transactions</h3>
      <span v-if='bs.bridge.snapshot.matches("FIND_OPERATIONS")'>Loading
        ...</span>
      <BridgeOperations
        v-else
        :operations="otherOperations"
      />
    </div>
  </div>

  <div v-else>
    Loading ...
  </div>
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
  grid-template-columns: auto auto;
  max-width: 100vw;
  &.NoOperation {
    grid-template-columns: auto;
    margin: auto;
    max-width: 120ch;
  }
  @media (max-width: 1024px) {
    grid-template-columns: auto;
    gap: 2rem;
  }
}
.MainOperationInput {
  display: grid;
  gap: 1rem;
}
.BridgeButton {
  margin: 1rem;
}
</style>
