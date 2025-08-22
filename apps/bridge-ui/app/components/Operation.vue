<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"
import type { ActorRefFromLogic } from "xstate"
import { statusFromState } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()
const machine = useSelector(operation, (state) => state)
const status = computed(() =>
	statusFromState(machine.value.value, machine.value.context.direction)
)
</script>
<template>
  <div class="Operation">
    <div class="Table">
      <div class="Row">
        <div>Status</div>
        <Label :title="machine.value" :is="status.kind">
          {{ status.text }}
        </Label>
      </div>
      <div class="Row">
        <div>From</div>
        <NetworkBadge :network="machine.context.source" />
      </div>
      <div class="Row">
        <div>To</div>
        <NetworkBadge :network="machine.context.destination" />
      </div>
      <div class="Row">
        <div>Amount</div>
        <div>{{ machine.context.amount }}</div>
      </div>
    </div>
    <div class="Explanation">
      <Switch>
        <Match :when='machine.matches("IDLE")'>
          The bridge operation is loading.
        </Match>
        <Match :when='machine.matches("SUBMIT_DEPOSIT")'>
          We are generating a transaction to deposit your funds from Mina L1 to
          Zeko L2.
        </Match>
        <Match :when='machine.matches("SUBMIT_WITHDRAWAL")'>
          We are generating a transaction to withdraw your funds from Zeko L2 to
          Mina L1.
        </Match>
        <Match :when='machine.matches("TO_FINALIZE")'>
          You must click on the "Finalize" button to complete the operation.
        </Match>
      </Switch>
    </div>
  </div>
  <div class="Button" v-if='machine.matches("TO_FINALIZE")'>
    <Button
      variant="cta2"
      @click='operation.send({ type: "Finalize" })'>Finalize</Button>
  </div>
</template>
<style lang="postcss" scoped>
.Operation {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1ch;
}
.Table {
  display: flex;
  flex-direction: column;
  gap: 1ch;
  width: fit-content;
  background: oklch(1 0 0 / 0.7);
  border-radius: 1rem;
  padding: 1rem;
}
.Explanation {
  padding: 1rem;
  background: var(--colors-blue-100);
  border-radius: 1rem;
}
.Row {
  display: grid;
  grid-template-columns: minmax(auto, 20ch) 1fr;
}
</style>
