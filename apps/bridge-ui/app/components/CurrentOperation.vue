<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"
import type { ActorRefFromLogic } from "xstate"
import { depositSteps, statePath, withdrawalSteps } from "~/helpers"
import { statusFromState } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()
const machine = useSelector(operation, (state) => state)
const steps = computed(() =>
	machine.value.context.direction === "deposit" ? depositSteps : withdrawalSteps
)

const step = computed(() => {
	// Special case for `WAITING_FOR_NETWORK` state
	if (machine.value.matches("WAITING_FOR_NETWORK")) {
		if (!machine.value.context.returnTo) return 0
		return {
			INIT_BRIDGE_OPERATION: 0,
			FINALIZE_DEPOSIT: 2,
			FINALIZE_WITHDRAWAL: 2,
			TO_FINALIZE: 2
		}[machine.value.context.returnTo]
	}
	const meta = machine.value.getMeta()
	return meta[statePath(machine.value.value)]?.step ?? 0
})

const status = computed(() =>
	statusFromState(machine.value.value, machine.value.context.direction)
)
const toFinalize = computed(() => machine.value.matches("TO_FINALIZE"))
const isLoading = computed(() => machine.value.hasTag("loading"))
const hasCTA = computed(() => machine.value.hasTag("cta"))
</script>
<template>
  <div :class="{ CurrentOperationWrapper: true, isLoading, hasCTA }">
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
            <SvgMinaLogo width="24" height="24" />
            <span>{{ machine.context.amount }}</span>
          </div>
        </div>
      </div>
      <div class="Bottom">
        <div>
          <Button
            v-if='machine.matches("WAITING_FOR_NETWORK")'
            variant="cta2"
            @click='
              machine.context.wallet.send({
              	type: "RequestNetworkChange",
              	network: machine.context.changeNetworkTo
              })
            '>Change Network</Button>

          <Button
            v-else
            variant="cta2"
            :disabled="!toFinalize"
            @click='operation.send({ type: "Finalize" })'>Finalize</Button>
        </div>
        <div class="Explanation">
          <Switch>
            <Match :when='machine.matches({ SUBMIT_DEPOSIT: "transaction" })'>
              We are generating a transaction to deposit your funds from Mina L1
              to Zeko L2.
            </Match>
            <Match
              :when='machine.matches({ SUBMIT_DEPOSIT: "send_and_confirm" })'>
              Waiting for the transaction to be confirmed.
            </Match>
            <Match :when='machine.matches("SUBMIT_WITHDRAWAL")'>
              We are generating a transaction to withdraw your funds from Zeko
              L2 to Mina L1.
            </Match>

            <Match :when='machine.matches("PENDING_DEPOSIT")'>
              <p>
                Waiting for the deposit transaction to be confirmed on Mina L1.
              </p>
              <p>
                This can take several minutes as we are waiting for 5 blocks or
                more.
              </p>
            </Match>
            <Match :when='machine.matches("PENDING_WITHDRAWAL")'>
              <p>
                Waiting for the withdrawal transaction to be confirmed on Zeko
                L2.
              </p>
              <p>
                This usually takes several minutes, but can take up to an hour
                as we are waiting for multiple blocks on L1 for security
                reasons.
              </p>
            </Match>
            <Match :when='machine.matches("INIT_BRIDGE_OPERATION")'>
              The bridge operation process is starting.
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
            <Match :when='machine.matches("WAITING_FOR_NETWORK")'>
              <div class="Flex">
                <span> You must swap to&nbsp;</span>
                <NetworkBadge :network="machine.context.changeNetworkTo" />
                <span>.</span>
              </div>
            </Match>
            <Match :when='machine.matches("FAILED")'>
              <div class="error">
                <p>
                  The bridge has encountered an error that is not recoverable
                </p>
                <p>
                  Don't worry, your funds are safe. <a
                    href="https://discord.gg/vSDxqAchUY"
                    target="_blank">Contact us on Discord</a>.
                </p>
              </div>
            </Match>
          </Switch>
        </div>
        <div class="Loading">
          <AnimatedLoadingSpinner v-if="isLoading" class="animation" />
          <AnimatedGreenCheckmark
            class="animation"
            v-else-if='machine.matches("BRIDGE_OPERATION_COMPLETED")'
          />
        </div>
      </div>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
@keyframes spinning-border {
  0%,
  100% {
    clip-path: inset(0 0 var(--spinning-border-clip-path-size) 0);
  }
  25% {
    clip-path: inset(0 0 0 var(--spinning-border-clip-path-size));
  }
  50% {
    clip-path: inset(var(--spinning-border-clip-path-size) 0 0 0);
  }
  75% {
    clip-path: inset(0 var(--spinning-border-clip-path-size) 0 0);
  }
}
.CurrentOperationWrapper {
  --spinning-border-clip-path-size: 99%;
  --background: oklch(1 0 0 / 0.6);
  --border-radius: 1rem;
  --border-size: 2px;
  --border-color: var(--palette-cosmicGold-50);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  height: 100%;
  padding: 2rem;
  background: var(--background);
  border-radius: var(--border-radius);
  &.hasCTA {
    box-shadow: 0 0 10vw 100vw oklch(0 0 0 / 0.2);
  }
  &.isLoading {
    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: var(--border-size) solid var(--border-color);
      border-radius: var(--border-radius);
      transition: all 0.5s;
      animation: spinning-border 3s infinite linear;
    }
  }
}
.Operation {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 2ch;
  flex: 1;
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
  .Bottom {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 2ch;
    align-items: flex-end;
    .Explanation {
      font-style: italic;
      max-width: 60ch;
      font-size: var(--typography_fluid-lexend-s);
      .Flex {
        display: flex;
      }
      p {
        margin: 0;
      }
    }
  }
}

.animation {
  --size: 6rem;
  height: var(--size);
  width: var(--size);
}

.error {
  &, a {
    color: var(--palette-persianRed-600);
  }
}
</style>
