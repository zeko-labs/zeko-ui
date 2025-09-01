<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"
import type { ActorRefFromLogic } from "xstate"
import { depositSteps, withdrawalSteps } from "~/helpers"
import { statusFromState } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()
const machine = useSelector(operation, (state) => state)
const steps = computed(() =>
	machine.value.context.direction === "deposit" ? depositSteps : withdrawalSteps
)

//TODO: Use xstate tags or metadata for easier rendering
const step = computed(() => {
	switch (true) {
		case machine.value.matches({ SUBMIT_DEPOSIT: "transaction" }):
		case machine.value.matches({ SUBMIT_WITHDRAWAL: "transaction" }):
			return 0
		case machine.value.matches({ SUBMIT_DEPOSIT: "send_and_confirm" }):
		case machine.value.matches({ SUBMIT_DEPOSIT: "done" }):
		case machine.value.matches({ SUBMIT_WITHDRAWAL: "send_and_confirm" }):
		case machine.value.matches({ SUBMIT_WITHDRAWAL: "done" }):
		case machine.value.matches("PENDING_DEPOSIT"):
		case machine.value.matches("PENDING_WITHDRAWAL"):
			return 1
		case machine.value.matches("TO_FINALIZE"):
		case machine.value.matches({ FINALIZE_DEPOSIT: "transaction" }):
		case machine.value.matches({ FINALIZE_WITHDRAWAL: "transaction" }):
			return 2
		case machine.value.matches({ FINALIZE_DEPOSIT: "send_and_confirm" }):
		case machine.value.matches({ FINALIZE_DEPOSIT: "done" }):
		case machine.value.matches({ FINALIZE_WITHDRAWAL: "send_and_confirm" }):
		case machine.value.matches({ FINALIZE_WITHDRAWAL: "done" }):
		case machine.value.matches("BRIDGE_OPERATION_DONE"):
		case machine.value.matches("BRIDGE_OPERATION_DONE_NOOP"):
			return 3
		default:
			return 0
	}
})
const status = computed(() =>
	statusFromState(machine.value.value, machine.value.context.direction)
)
const toFinalize = computed(() => machine.value.matches("TO_FINALIZE"))
</script>
<template>
  <div
    :class="
      {
      	CurrentOperationWrapper: true,
      	Finalize: toFinalize
      }
    ">
    <div class="ProgressBar">
      <ProgressBar :steps :step />
    </div>
    <div class="Operation">
      <div class="Table">
        <div class="Row">
          <div>Status</div>
          <Label :title="JSON.stringify(machine.value)" :is="status.kind">
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
            This can take several minutes as we are waiting for several blocks
            for security reasons.
          </Match>
          <Match :when='machine.matches("INIT_BRIDGE_OPERATION")'>
            The bridge operation process is starting.
          </Match>
          <Match :when='machine.matches("SUBMIT_DEPOSIT")'>
            We are generating a transaction to deposit your funds from Mina L1
            to Zeko L2.
          </Match>
          <Match :when='machine.matches("SUBMIT_WITHDRAWAL")'>
            We are generating a transaction to withdraw your funds from Zeko L2
            to Mina L1.
          </Match>
          <Match :when='machine.matches("TO_FINALIZE")'>
            You must click on the "Finalize" button to complete the operation.
          </Match>
          <Match
            :when='
              machine.matches({ FINALIZE_DEPOSIT: "transaction" }) ||
              machine.matches({ FINALIZE_WITHDRAWAL: "transaction" })
            '>
            We are generating a proof on the sequencer. You'll have to sign
            next.
          </Match>
          <Match
            :when='machine.matches({ FINALIZE_WITHDRAWAL: "send_and_confirm" })'>
            Finalize Withdrawal Transaction has been sent, waiting on L1
            confirmation.
          </Match>
          <Match
            :when='machine.matches({ FINALIZE_DEPOSIT: "send_and_confirm" })'>
            Finalize Deposit Transaction has been sent, waiting on L2
            confirmation.
          </Match>
        </Switch>
      </div>
      <div v-if="toFinalize">
        <Button
          variant="cta2"
          @click='operation.send({ type: "Finalize" })'>Finalize</Button>
      </div>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.CurrentOperationWrapper {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: start;
  gap: 1rem;
  background: oklch(1 0 0 / 0.7);
  border-radius: 1rem;
  height: 100%;
  &.Finalize {
    justify-content: space-between;
  }
}
.Operation {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 2ch;
  flex: 1;
  &.Finalize {
    flex: 1;
    grid-template-rows: 1fr auto auto;
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
