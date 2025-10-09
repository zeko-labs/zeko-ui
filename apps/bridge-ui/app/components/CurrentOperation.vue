<script lang="ts" setup>
import type { ActorRefFromLogic } from "xstate"
// biome-ignore lint/correctness/noUnusedImports: template
import { bridgeMessages, errorToaster, statePath, steps } from "~/helpers"
import { statusFromState } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import { useSelector } from "~~/machines/vue-xstate"

const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()
const machine = useSelector(operation, (state) => state)

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

watch(machine.value.context.errors, (newErrors) => {
	if (newErrors) {
		const [e] = newErrors.toReversed()
		if (e) {
			console.error(`A total of ${newErrors.length} errors have occurred.`)
			errorToaster.create({
				title: "Error",
				description: e.message,
				type: "error",
				duration: Number.POSITIVE_INFINITY
			})
		}
	}
})
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
            {{
              {
              	complete: "Completed",
              	pending: "Pending",
              	error: "Failed"
              }[status.kind]
            }}
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
            <SvgMinaLogo width="24" height="24" />
            <span>MINA</span>
          </div>
        </div>
      </div>
      <div class="Bottom">
        <div>
          <Button
            v-if='machine.matches("WAITING_FOR_NETWORK")'
            variant="main"
            @click='
              machine.context.wallet.send({
              	type: "RequestNetworkChange",
              	network: machine.context.changeNetworkTo
              })
            '>Change Network</Button>
          <Button
            v-else
            variant="main"
            :disabled="!toFinalize"
            @click='operation.send({ type: "Finalize" })'>Claim</Button>
        </div>
        <div class="Explanation">
          <Switch>
            <Match
              :when='
                machine.matches("SUBMIT_WITHDRAWAL") ||
                machine.matches({ SUBMIT_DEPOSIT: "transaction" })
              '>
              {{ bridgeMessages.submit }}
            </Match>
            <Match
              :when='machine.matches({ SUBMIT_DEPOSIT: "send_and_confirm" })'>
              {{ bridgeMessages.submitDeposit.sendAndConfirm }}
            </Match>
            <Match
              :when='
                machine.matches("PENDING_DEPOSIT") ||
                machine.matches("PENDING_WITHDRAWAL")
              '>
              {{ bridgeMessages.pending }}
            </Match>
            <Match :when='machine.matches("INIT_BRIDGE_OPERATION")'>
              {{ bridgeMessages.initBridgeOperation }}
            </Match>
            <Match :when='machine.matches("TO_FINALIZE")'>
              {{ bridgeMessages.toFinalize }}
            </Match>
            <Match
              :when='
                machine.matches({ FINALIZE_DEPOSIT: "transaction" }) ||
                machine.matches({ FINALIZE_WITHDRAWAL: "transaction" })
              '>
              {{ bridgeMessages.finalizeTransaction }}
            </Match>
            <Match
              :when='machine.matches({ FINALIZE_DEPOSIT: "send_and_confirm" })'>
              {{ bridgeMessages.finalizeDeposit.sendAndConfirm }}
            </Match>

            <Match
              :when='machine.matches({ FINALIZE_WITHDRAWAL: "send_and_confirm" })'>
              {{ bridgeMessages.finalizeWithdrawal.sendAndConfirm }}
            </Match>

            <Match :when='machine.matches("WAITING_FOR_NETWORK")'>
              <div class="Flex">
                <span>Switch your wallet to&nbsp;</span>
                <NetworkBadge :network="machine.context.changeNetworkTo" />
                <span>.</span>
              </div>
            </Match>
            <Match :when='machine.matches("FAILED")'>
              <div class="error">
                <p>
                  Something went wrong.
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
      </div>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.CurrentOperationWrapper {
  --spinning-border-clip-path-size: 99%;
  --background: oklch(1 0 0 / 0.6);
  --border-radius: 1rem;
  --border-size: 2px;
  --border-color: var(--palette-cosmicGold-50);
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  height: 100%;
  padding: 2rem;
  background: var(--background);
  border-radius: var(--border-radius);
  &.hasCTA {
    box-shadow: 0 0 10vw 300vw oklch(0 0 0 / 0.3);
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
