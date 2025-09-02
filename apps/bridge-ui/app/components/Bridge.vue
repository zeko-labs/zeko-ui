<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"
import { errorToaster } from "~/helpers"

const bs = useBridgeStore()

const amountToBridge = ref<number | undefined>(undefined)

// const allOperations = useSelector(bs.bridge.actorRef, (state) => [
// 	...state.context.operations.values()
// ])

const firstNonCompleteOperation = useSelector(
	bs.bridge.actorRef,
	(state) =>
		[...state.context.operations.values()].find(
			(op) => op.status !== "completed"
		)?.operation
)

const otherOperations = useSelector(bs.bridge.actorRef, (state) =>
	[...state.context.operations.values()]
		.filter((op) => op.operation.id !== firstNonCompleteOperation.value?.id)
		.map(({ operation, status }) => ({
			id: operation.id,
			status,
			operation
		}))
)

const firstNonCompleteOperationErrors = computed(
	() => firstNonCompleteOperation.value?.getSnapshot().context.errors
)

watch(firstNonCompleteOperationErrors, (errors) => {
	if (errors) {
		const [e] = errors.toReversed()
		if (e) {
			errorToaster.create({
				title: "Error",
				description: e.message,
				type: "error"
			})
		}
	}
})
</script>
<template>
  <Disabled
    v-if='
      bs.currentNetwork.includes("mainnet") ||
      bs.wallet.snapshot.error ||
      (bs.address.length === 0 && bs.wallet.snapshot.matches("INIT"))
    '
  />
  <div
    class="Bridge"
    v-else-if='!bs.currentNetwork.includes("mainnet")'>
    <div
      class="MainOperation"
      :class="{ NoOperation: !firstNonCompleteOperation }">
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
          :disabled="!amountToBridge || amountToBridge <= 0 || bs.address.length === 0">
          Bridge
        </Button>
      </div>
      <CurrentOperation
        v-if="firstNonCompleteOperation"
        :operation="firstNonCompleteOperation"
      />
    </div>
    <div class="RecentTransactions">
      <h3>Recent Transactions</h3>
      <span
        v-if='bs.bridge.snapshot.matches("FIND_OPERATIONS")'>Loading...</span>
      <BridgeOperations
        v-else
        :operations="otherOperations"
      />
    </div>
  </div>

  <div v-else>
    Loading ...
  </div>
  <Toast :toaster="errorToaster" />
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
  gap: 2ch;
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
  border: 1px solid var(--colors-alpha-soft-gray1);
  border-radius: 1rem;
  padding: 2rem;
}
</style>
