<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"
import type { ActorRefFromLogic } from "xstate"
import { depositSteps, withdrawalSteps } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()
const machine = useSelector(operation, (state) => state)
const steps = computed(() =>
	machine.value.value ?? machine.value.context.direction === "deposit"
		? depositSteps
		: withdrawalSteps
)

const step = computed(() => {
	switch (machine.value.value) {
		case "SUBMIT_DEPOSIT":
		case "SUBMIT_WITHDRAWAL":
			return 0
		case "PENDING_DEPOSIT":
		case "PENDING_WITHDRAWAL":
			return 1
		case "TO_FINALIZE":
		case "FINALIZE_DEPOSIT":
		case "FINALIZE_WITHDRAWAL":
			return 2
		case "BRIDGE_OPERATION_DONE":
		case "BRIDGE_OPERATION_DONE_NOOP":
			return 3
		default:
			return 0
	}
})
</script>
<template>
  <div
    :class='
      {
      	CurrentOperationWrapper: true,
      	Finalize: machine.matches("TO_FINALIZE")
      }
    '>
    <div class="ProgressBar">
      <ProgressBar :steps :step />
    </div>
    <Operation :operation />
  </div>
</template>
<style lang="postcss" scoped>
.CurrentOperationWrapper {
  padding: 0 2rem;
  display: flex;
  flex-direction: column;
  justify-content: start;
  gap: 1rem;
  &.Finalize {
    justify-content: space-between;
  }
}
</style>
