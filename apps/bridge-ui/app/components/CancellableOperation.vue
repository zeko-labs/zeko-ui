<script setup lang="ts">
import { ArrowBigRightDashIcon } from "lucide-vue-next"
import type { ActorRefFromLogic } from "xstate"
import { formatQueueMetadata, statusFromState } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import { useSelector } from "~~/machines/vue-xstate"

const {
	operation,
	index = 0,
	currentSlot,
	disabled = false
} = defineProps<{
	currentSlot?: string
	index: number
	disabled?: boolean
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()

const machine = useSelector(operation, (state) => state)

const status = computed(() =>
	statusFromState(machine.value.value, machine.value.context.direction, {
		canCancel: machine.value.context.canCancel
	})
)

const metadata = computed(() =>
	formatQueueMetadata({
		cancellable: machine.value.context.canCancel,
		direction: machine.value.context.direction,
		currentSlot,
		timeoutSlot: machine.value.context.timeoutSlot,
		timeoutSlots: machine.value.context.timeoutSlots,
		transaction: machine.value.context.transaction
	})
)

const readyToCancel = computed(
	() =>
		machine.value.context.canCancel === true &&
		(machine.value.matches("PAUSED") || machine.value.matches("CAN_CANCEL"))
)

const waitingForCancellationNetwork = computed(
	() =>
		machine.value.matches("WAITING_FOR_NETWORK") &&
		machine.value.context.returnTo === "CANCEL_DEPOSIT"
)

const cancelling = computed(
	() =>
		waitingForCancellationNetwork.value ||
		machine.value.matches("CANCEL_DEPOSIT")
)

const message = computed(() => {
	if (machine.value.matches("DEPOSIT_CANCELLED"))
		return "Deposit cancelled on Mina."
	if (waitingForCancellationNetwork.value)
		return "Switch your wallet to Mina to cancel."
	if (machine.value.matches({ CANCEL_DEPOSIT: "transaction" }))
		return "Preparing the cancellation transaction."
	if (machine.value.matches({ CANCEL_DEPOSIT: "done" }))
		return "Waiting for cancellation confirmation."
	if (readyToCancel.value) return "Ready to reclaim funds on Mina."
	if (machine.value.matches("FAILED")) return "Cancellation failed."
	return "This deposit can be cancelled separately."
})
</script>

<template>
  <div class="Wrapper" :class="{ disabled }">
    <div class="Top">
      <div class="Index">#{{ index + 1 }}</div>
      <Label :is="status.kind">{{ status.text }}</Label>
    </div>
    <div class="Middle">
      <NetworkBadge :icon="true" :network="machine.context.source" />
      <ArrowBigRightDashIcon class="arrow" />
      <NetworkBadge :icon="true" :network="machine.context.destination" />
    </div>
    <div class="Bottom">
      <div class="Details">
        <div class="Mina">
          <SvgMinaLogo width="24" height="24" />
          <span>{{ machine.context.amount }}</span>
        </div>
        <div v-if="metadata.length > 0" class="Metadata">
          <p v-for="line in metadata" :key="line">{{ line }}</p>
        </div>
        <p>{{ message }}</p>
      </div>
      <Button
        variant="cancel"
        :disabled="disabled || !readyToCancel || cancelling"
        @click='operation.send({ type: "Cancel" })'>
        {{ cancelling ? "Cancelling" : "Cancel" }}
      </Button>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.Wrapper {
  --background: oklch(1 0 0 / 0.6);
  display: grid;
  gap: 1rem;
  min-width: 20rem;
  background: var(--background);
  border: 1px solid var(--background);
  padding: 1rem;
  border-radius: 1rem;

  &.disabled {
    opacity: 0.7;
  }

  .Top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;

    .Index {
      --size: 3ch;
      border-radius: 4rem;
      min-width: var(--size);
      min-height: var(--size);
      padding: 0.25rem;
      aspect-ratio: 1 / 1;
      display: grid;
      place-items: center;
      border: 1px solid var(--palette-alpha-soft-gray1);
      background: oklch(from var(--palette-cosmicGold-50) l c h / 0.1);
      font-size: var(--typography_fluid-lexend-xs);
    }
  }

  .Middle {
    display: grid;
    grid-template-columns: repeat(3, minmax(max-content, 1fr));
    align-items: center;
    gap: 1ch;
    font-size: var(--typography_fluid-lexend-l);

    .arrow {
      color: var(--palette-yellow-500);
    }
  }

  .Bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;

    .Details {
      display: grid;
      gap: 0.5rem;

      p {
        margin: 0;
        max-width: 22rem;
        color: var(--palette-gray-600);
        font-size: var(--typography_fluid-lexend-xs);
      }
    }

    .Metadata {
      display: grid;
      gap: 0.25rem;
    }

    .Mina {
      display: flex;
      place-items: center;
      gap: 0.5ch;
    }
  }
}
</style>
