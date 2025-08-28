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
        <div class="Mina">
          <span>{{ machine.context.amount }}</span>
          <SvgMinaToken width="24" height="24" />
        </div>
      </div>
    </div>
    <div class="Explanation">
      <Switch>
        <Match :when='machine.matches("WAITING_FOR_NETWORK")'>
          Swap to the correct network
        </Match>
        <Match :when='machine.matches("PENDING_DEPOSIT")'>
          Waiting for the deposit transaction to be confirmed on Mina L1. This
          can take several minutes as we are waiting for 5 blocks or more.
        </Match>
        <Match :when='machine.matches("PENDING_WITHDRAWAL")'>
          Waiting for the withdrawal transaction to be confirmed on Zeko L2.
          This should be pretty fast.
        </Match>
        <Match :when='machine.matches("INIT_BRIDGE_OPERATION")'>
          The bridge operation process is starting.
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
        <Match :when='machine.matches("FINALIZE_DEPOSIT")'>
          We are generating a proof on the sequencer. You'll have to sign next.
        </Match>
      </Switch>
    </div>
    <div v-if='machine.matches("TO_FINALIZE")'>
      <Button
        variant="cta2"
        @click='operation.send({ type: "Finalize" })'>Finalize</Button>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Operation {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 2ch;
  background: oklch(1 0 0 / 0.7);
  border-radius: 1rem;
  padding: 1rem;
  &.Finalize {
    grid-template-rows: 1fr auto auto;
    flex: 1;
  }
  .Table {
    display: flex;
    flex-direction: column;
    gap: 1ch;
    width: 100%;
    .Row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .Mina {
        display: flex;
        place-items: center;
        gap: 0.5ch;
      }
    }
  }
  .Explanation {
    font-style: italic;
    font-size: var(--fonts-lexend-typescale-scale-s);
  }
}
</style>
