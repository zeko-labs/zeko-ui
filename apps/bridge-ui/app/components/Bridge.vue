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
  <div class="Bridge" v-if='!bs.currentNetwork.includes("mainnet")'>
    <div class="MainOperation">
      <div class="MainOperationInput" v-show="bs.walletLoaded">
        <div class="InputBox">
          <h3>Sending</h3>
          <BridgeAmountSelector v-model="amountToBridge" />
        </div>

        <FromTo
          :source="bs.bridge.snapshot.context.sourceNetwork"
          :destination="bs.bridge.snapshot.context.destinationNetwork"
        />
        <Button
          class="BridgeButton"
          variant="cta2"
          v-if='bs.bridge.snapshot.matches("READY")'
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
      <div class="CurrentOperationWrapper">
        <template v-if="firstOperation">
          <ProgressBarWrapper :operation="firstOperation" />
          <Operation :operation="firstOperation" />
        </template>

        <!-- <button
      @click="step--"
      :disabled="step === 0">
      Previous Step
    </button>
    <button
      @click="step++"
      :disabled="step === steps.length - 1">
      Next Step
    </button> -->
      </div>
    </div>
    <div>
      <h2>Recent Transactions</h2>
      <BridgeOperations :operations="otherOperations" />
    </div>
  </div>
  <div class="Disabled" v-else>
    <p>The bridge is only available on testnet.</p>
  </div>
</template>
<style lang="postcss" scoped>
:deep(.InputBox) {
  display: grid;
  grid-template-columns: 20ch 1fr;
  align-items: center;
}
.MainOperation {
  display: grid;
  grid-template-columns: auto auto;
}
.MainOperationInput {
  display: grid;
  gap: 1rem;
  max-width: 50vw;
}
.BridgeButton {
  margin-top: 1rem;
}
.CurrentOperationWrapper {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
