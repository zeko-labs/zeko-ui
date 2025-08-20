<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"
import { depositSteps, withdrawalSteps } from "~/helpers"

const bs = useBridgeStore()

const amountToBridge = ref<number | undefined>(undefined)

const source = computed(() => bs.bridge.snapshot.context.sourceNetwork)

const direction = computed(() =>
	source.value.includes("mina") ? "deposit" : "withdrawal"
)

const operationsForTable = useSelector(bs.bridge.actorRef, (state) =>
	[...state.context.operations.entries()].map(([id, value]) => ({
		id,
		operation: value.operation
	}))
)

const firstOperation = computed(() => operationsForTable.value[0])

const steps = computed(() =>
	firstOperation.value?.operation.getSnapshot().context.direction ??
	direction.value === "deposit"
		? depositSteps
		: withdrawalSteps
)

const step = computed(() => {
	const status = firstOperation.value?.operation.getSnapshot().value
	switch (status) {
		case "SUBMIT_DEPOSIT":
		case "SUBMIT_WITHDRAWAL":
			return 1
		case "PENDING_DEPOSIT":
		case "PENDING_WITHDRAWAL":
			return 2
		case "FINALIZE_DEPOSIT":
		case "FINALIZE_WITHDRAWAL":
			return 3
		case "BRIDGE_OPERATION_DONE":
		case "BRIDGE_OPERATION_DONE_NOOP":
			return 4
		default:
			return 0
	}
})
</script>
<template>
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
    <div class="ProgressBarWrapper">
      <template v-if="firstOperation">
        <ProgressBar :steps :step />
        <Operation :operation="firstOperation?.operation" />
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
    <BridgeOperations :operations="operationsForTable" />
  </div>
</template>
<style lang="postcss">
.debug {
  background-color: palegoldenrod;
  padding: 1rem;
}
</style>
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
.ProgressBarWrapper {
  padding: 2rem 0 3rem 0;
}
</style>
