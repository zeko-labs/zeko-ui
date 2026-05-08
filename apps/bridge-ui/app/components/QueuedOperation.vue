<script setup lang="ts">
import { ArrowBigRightDashIcon } from "lucide-vue-next"
import type { ActorRefFromLogic } from "xstate"
import { formatQueueMetadata, statusFromState } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import { useSelector } from "~~/machines/vue-xstate"

const {
	operation,
	index = 0,
	currentSlot
} = defineProps<{
	currentSlot?: string
	index: number
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
const transactionHash = computed(
	() => machine.value.context.transaction?.hash ?? ""
)
const shortTransactionHash = computed(() => {
	const hash = transactionHash.value
	if (hash.length <= 18) return hash
	return `${hash.slice(0, 10)}...${hash.slice(-6)}`
})
</script>
<template>
  <div class="Wrapper">
    <div class="Top">
      <div v-if="transactionHash" class="Hash" :title="transactionHash">
        {{ shortTransactionHash }}
      </div>
      <div class="Index">#{{ index + 1 }}</div>
    </div>
    <div class="Middle">
      <NetworkBadge :icon="true" :network="machine.context.source" />
      <ArrowBigRightDashIcon class="arrow" />
      <NetworkBadge :icon="true" :network="machine.context.destination" />
    </div>
    <div class="Bottom">
      <Label :is="status.kind">{{ status.text }}</Label>
      <div class="Mina">
        <SvgMinaLogo width="24" height="24" />
        <span>{{ machine.context.amount }}</span>
      </div>
    </div>
    <div v-if="metadata.length > 0" class="Metadata">
      <p v-for="line in metadata" :key="line">{{ line }}</p>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Wrapper {
  --background: oklch(1 0 0 / 0.6);
  position: relative;
  z-index: 0;
  display: grid;
  gap: 1ch;
  width: fit-content;
  background: var(--background);
  border: 1px solid var(--background);
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  &:hover {
    border: 1px solid var(--palette-cosmicGold-medium);
    transition: all 0.1s;
  }
  .Top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    min-width: 15rem;
    .Hash {
      max-width: 12rem;
      overflow: hidden;
      color: var(--palette-gray-600);
      font-family: monospace;
      font-size: var(--typography_fluid-lexend-xs);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
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
    align-items: center;
    .Mina {
      display: flex;
      place-items: center;
      gap: 0.5ch;
    }
  }
  .Metadata {
    display: grid;
    gap: 0.25rem;
    p {
      margin: 0;
      color: var(--palette-gray-600);
      font-size: var(--typography_fluid-lexend-xs);
      white-space: nowrap;
    }
  }
}
</style>
