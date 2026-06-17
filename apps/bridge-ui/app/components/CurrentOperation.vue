<script lang="ts" setup>
import type { ActorRefFromLogic } from "xstate"
import { toUserFriendlyMessage } from "~/errors"
import {
	errorToaster,
	progressFromState,
	statePath,
	statusFromState
} from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import { bridgeNetworkToWalletNetwork } from "~~/machines/networks"
import type { transactionMachine } from "~~/machines/transaction"
import { useSelector } from "~~/machines/vue-xstate"

const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()
const machine = useSelector(operation, (state) => state)
const transactionActor = computed(
	() =>
		machine.value.children.transaction as
			| ActorRefFromLogic<typeof transactionMachine>
			| undefined
)
const transaction = useSelector(transactionActor, (state) => state)

const machineStep = computed(() => {
	// Special case for `WAITING_FOR_NETWORK` state
	if (machine.value.matches("WAITING_FOR_NETWORK")) {
		if (!machine.value.context.returnTo) return 0
		switch (machine.value.context.returnTo) {
			case "INIT_BRIDGE_OPERATION":
				return 0
			case "FINALIZE_DEPOSIT":
			case "FINALIZE_WITHDRAWAL":
			case "TO_FINALIZE":
				return 2
			default:
				return 0
		}
	}
	const meta = machine.value.getMeta()
	return meta[statePath(machine.value.value)]?.step ?? 0
})
const uiProgress = computed(() =>
	progressFromState({
		step: machineStep.value
	})
)

const status = computed(() =>
	statusFromState(machine.value.value, machine.value.context.direction, {
		canCancel: machine.value.context.canCancel
	})
)
const toFinalize = computed(() => machine.value.matches("TO_FINALIZE"))
const transactionIsComplete = (
	key: keyof typeof machine.value.context.transactions
) =>
	transactionActor.value?.getSnapshot().context.key === key &&
	transaction.value?.matches("COMPLETE") === true
const isLoading = computed(() => machine.value.hasTag("loading"))
const hasCTA = computed(() => machine.value.hasTag("cta"))
const requestNetworkChange = () => {
	machine.value.context.wallet.send({
		type: "RequestNetworkChange",
		network: bridgeNetworkToWalletNetwork(machine.value.context.changeNetworkTo)
	})
}

watch(machine.value.context.errors, (newErrors) => {
	if (newErrors) {
		const [e] = newErrors.toReversed()
		if (e) {
			console.error(`A total of ${newErrors.length} errors have occurred.`)
			errorToaster.create({
				title: "Error",
				description: toUserFriendlyMessage(e),
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
      <ProgressBar :steps="uiProgress.steps" :step="uiProgress.step" />
    </div>
    <div class="Operation">
      <div class="Table">
        <div class="Row">
          <div>Status</div>
          <Label :title="JSON.stringify(machine.value)" :is="status.kind">
            {{
              {
              	complete: "Completed",
              	cancelled: "Cancelled",
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
            @click="requestNetworkChange">
            Change Network
          </Button>
          <Button
            v-else
            variant="main"
            :disabled="!toFinalize"
            @click='operation.send({ type: "Finalize" })'>
            Claim
          </Button>
        </div>
        <div class="Explanation">
          <template v-if='machine.matches("INIT_BRIDGE_OPERATION")'>
            <BridgeMessage messageKey="initBridgeOperation" />
          </template>

          <template
            v-else-if='
              machine.matches({ SUBMIT_WITHDRAWAL: "transaction" }) &&
              !transactionIsComplete("submitWithdrawal")
            '>
            <BridgeMessage messageKey="submit" />
          </template>

          <template
            v-else-if='
              machine.matches({ SUBMIT_WITHDRAWAL: "transaction" }) &&
              transactionIsComplete("submitWithdrawal")
            '>
            <BridgeMessage
              messageKey="submitDeposit"
              :transactions="machine.context.transactions"
              transactionKey="submitWithdrawal"
            />
          </template>

          <template
            v-else-if='
              machine.matches({ SUBMIT_DEPOSIT: "transaction" }) &&
              !transactionIsComplete("submitDeposit")
            '>
            <BridgeMessage messageKey="submit" />
          </template>

          <template
            v-else-if='
              machine.matches({ SUBMIT_DEPOSIT: "transaction" }) &&
              transactionIsComplete("submitDeposit")
            '>
            <BridgeMessage
              messageKey="submitDeposit"
              :transactions="machine.context.transactions"
              transactionKey="submitDeposit"
            />
          </template>

          <template v-else-if='machine.matches("PENDING_DEPOSIT")'>
            <BridgeMessage
              messageKey="pending"
              :transactions="machine.context.transactions"
              transactionKey="submitDeposit"
            />
          </template>

          <template v-else-if='machine.matches("PENDING_WITHDRAWAL")'>
            <BridgeMessage
              messageKey="pending"
              :transactions="machine.context.transactions"
              transactionKey="submitWithdrawal"
            />
          </template>

          <template v-else-if='machine.matches("TO_FINALIZE")'>
            <BridgeMessage messageKey="toFinalize" />
          </template>

          <template v-else-if='machine.matches("CAN_CANCEL")'>
            <div class="warning"><BridgeMessage messageKey="canCancel" /></div>
          </template>

          <template
            v-else-if='
              machine.matches({ CANCEL_DEPOSIT: "transaction" }) &&
              !transactionIsComplete("cancelDeposit")
            '>
            <BridgeMessage messageKey="cancellingDeposit" />
          </template>

          <template
            v-else-if='
              machine.matches({ CANCEL_DEPOSIT: "transaction" }) &&
              transactionIsComplete("cancelDeposit")
            '>
            <BridgeMessage
              messageKey="cancelDeposit"
              :transactions="machine.context.transactions"
              transactionKey="cancelDeposit"
            />
          </template>

          <template v-else-if='machine.matches("DEPOSIT_CANCELLED")'>
            <BridgeMessage messageKey="depositCancelled" />
          </template>

          <template
            v-else-if='
              machine.matches({ FINALIZE_DEPOSIT: "transaction" }) &&
              !transactionIsComplete("finalizeDeposit")
            '>
            <BridgeMessage messageKey="finalizeTransaction" />
          </template>

          <template
            v-else-if='
              machine.matches({ FINALIZE_DEPOSIT: "transaction" }) &&
              transactionIsComplete("finalizeDeposit")
            '>
            <BridgeMessage
              messageKey="finalizeDeposit"
              :transactions="machine.context.transactions"
              transactionKey="finalizeDeposit"
            />
          </template>

          <template
            v-else-if='
              machine.matches({ FINALIZE_WITHDRAWAL: "transaction" }) &&
              !transactionIsComplete("finalizeWithdrawal")
            '>
            <BridgeMessage messageKey="finalizeTransaction" />
          </template>

          <template
            v-else-if='
              machine.matches({ FINALIZE_WITHDRAWAL: "transaction" }) &&
              transactionIsComplete("finalizeWithdrawal")
            '>
            <BridgeMessage
              messageKey="finalizeWithdrawal"
              :transactions="machine.context.transactions"
              transactionKey="finalizeWithdrawal"
            />
          </template>

          <template v-else-if='machine.matches("WAITING_FOR_NETWORK")'>
            <div class="NetworkPrompt">
              <span class="NetworkPromptText">Switch your wallet to</span>
              <NetworkBadge :network="machine.context.changeNetworkTo" />
              <span>.</span>
            </div>
          </template>

          <template v-else-if='machine.matches("FAILED")'>
            <div class="error">
              <p>Something went wrong.</p>
              <p>
                Don't worry, your funds are safe.
                <a href="https://discord.gg/vSDxqAchUY" target="_blank">Contact
                  us on Discord</a>.
              </p>
            </div>
          </template>
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
      .NetworkPrompt {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.35ch;
      }
      .NetworkPromptText {
        white-space: nowrap;
      }
      p {
        margin: 0;
      }
      b {
        font-weight: var(--typography-weight-lexend-semibold);
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
  &,
  a {
    color: var(--palette-persianRed-600);
  }
}
</style>
