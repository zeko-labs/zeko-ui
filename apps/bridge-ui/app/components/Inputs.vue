<script lang="ts" setup>
import { ZEKO_M_NETWORKS } from "@zeko/networks"
import {
	amountIsBelowBridgeMinimum,
	type BridgeAmountInput,
	BRIDGE_MINIMUM_AMOUNT_MINA,
	canStartBridgeOperation,
	normalizeBridgeAmountInput
} from "./bridgeInputs"
import { selectedBridgeFeeDisclosure } from "./bridgeFees"
import { formatBridgeNetworkLabel } from "~~/machines/networks"

const bs = useBridgeStore()
const bridgeSettings = useBridgeSettings()

const amountToBridge = ref<BridgeAmountInput>(undefined)
const ledgerUnsupportedNetworkLabel = formatBridgeNetworkLabel(
	ZEKO_M_NETWORKS.mainnet
)

const startBridge = () => {
	if (!canStart.value) return
	const normalizedAmount = normalizeBridgeAmountInput(amountToBridge.value)
	if (normalizedAmount === undefined) return
	bs.bridge.send({
		type: "StartOperation",
		amount: normalizedAmount.toString(),
		timeoutSlots: bridgeSettings.timeoutSlots.value
	})
	amountToBridge.value = undefined
}
const loading = computed(() => !bs.bridge.snapshot.matches("READY"))
const amountIsBelowMinimum = computed(() =>
	amountIsBelowBridgeMinimum(amountToBridge.value)
)
const canStart = computed(() =>
	canStartBridgeOperation({
		address: bs.address,
		amount: amountToBridge.value,
		loading: loading.value
	})
)
const disabledButton = computed(() => !canStart.value)
const selectedFeeDisclosure = computed(() =>
	selectedBridgeFeeDisclosure({
		source: bs.bridge.snapshot.context.sourceNetwork,
		destination: bs.bridge.snapshot.context.destinationNetwork
	})
)
</script>
<template>
  <div :class="{ Inputs: true, isLoading: loading }">
    <div class="InputBox">
      <h4>Sending</h4>
      <BridgeAmountSelector
        v-model="amountToBridge"
        :loading
        :invalid="amountIsBelowMinimum"
      />
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
      <aside
        class="BridgeNotice"
        :data-minimum-mina="BRIDGE_MINIMUM_AMOUNT_MINA">
        <template v-if="loading">
          Please wait… The Zeko Bridge is loading your wallet's latest
          transaction history and status.
        </template>
        <template v-else>
          <span>Bridging requires signing two transactions:</span>
          <ol class="BridgeSteps">
            <li>Send from the origin chain.</li>
            <li>Claim to the destination chain.</li>
          </ol>
          <span>
            Ledger hardware wallets are not yet supported by
            {{ ledgerUnsupportedNetworkLabel }}.
          </span>
          <strong>Bridge minimum 2 MINA.</strong>
        </template>
      </aside>
    </div>
    <BridgeFeeNotice :fees="selectedFeeDisclosure" />
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
  gap: 2rem;
  align-items: center;
  justify-content: start;
}

.BridgeNotice {
  display: grid;
  gap: 0.35rem;
}

.BridgeSteps {
  margin: 0;
  padding-left: 1.25rem;
}
</style>
