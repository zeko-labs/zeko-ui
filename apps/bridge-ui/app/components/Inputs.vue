<script lang="ts" setup>
const bs = useBridgeStore()
const bridgeSettings = useBridgeSettings()

const amountToBridge = ref<number | undefined>(undefined)

const startBridge = () => {
	const amount = (amountToBridge.value ?? 0).toString()
	bs.bridge.send({
		type: "StartOperation",
		amount,
		timeoutSlots: bridgeSettings.timeoutSlots.value
	})
	amountToBridge.value = undefined
}
const loading = computed(() => !bs.bridge.snapshot.matches("READY"))
const disabledButton = computed(
	() =>
		loading.value ||
		!amountToBridge.value ||
		amountToBridge.value <= 0 ||
		bs.address.length === 0
)
</script>
<template>
  <div :class="{ Inputs: true, isLoading: loading }">
    <div class="InputBox">
      <h4>Sending</h4>
      <BridgeAmountSelector v-model="amountToBridge" :loading />
    </div>

    <FromTo
      :loading
      :source="bs.bridge.snapshot.context.sourceNetwork"
      :destination="bs.bridge.snapshot.context.destinationNetwork"
    />
    <div class="Bottom">
      <Button
        class="BridgeButton"
        variant="main"
        @click="startBridge"
        :disabled="disabledButton">
        Send
      </Button>
      <aside>
        <Switch>
          <Match :when="loading">
            Please wait… The Zeko Bridge is loading your wallet's latest
            transaction history and status.
          </Match>
          <Fallback>
            Bridging requires signing two transactions: 1) Send from the origin
            chain, then 2) Claim to the destination chain.
          </Fallback>
        </Switch>
      </aside>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Inputs {
  --spinning-border-clip-path-size: 99%;
  --background: oklch(1 0 0 / 0.4);
  --border-radius: 1rem;
  --border-size: 2px;
  --border-color: var(--palette-cosmicGold-50);
  display: grid;
  position: relative;
  gap: 1rem;
  padding: 2rem;
  background: var(--background);
  border-radius: var(--border-radius);
  &:not(.isLoading) {
    border: var(--border-size) solid var(--palette-gray-300);
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

/* biome-ignore lint/correctness/noUnknownPseudoClass: reason */
:deep(.InputBox) {
  display: grid;
  grid-template-columns: 20ch 1fr;
  align-items: center;
  @media (max-width: 1024px) {
    grid-template-columns: 10ch 1fr;
  }
}

.Bottom {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: start;
}
</style>
