<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"

const bs = useBridgeStore()

const amountToBridge = ref<number | undefined>(undefined)

const allOperations = useSelector(bs.bridge.actorRef, (state) =>
	[...state.context.operations.entries()].map(([id, value]) => ({
		id,
		operation: value.operation
	}))
)

const firstOperation = computed(() => allOperations.value[0]?.operation)
const otherOperations = computed(() => allOperations.value.slice(1))
</script>
<template>
  <div
    class="Bridge"
    v-if='!bs.currentNetwork.includes("mainnet") && bs.walletLoaded'>
    <div class="MainOperation" :class="{ NoOperation: !firstOperation }">
      <div class="MainOperationInput">
        <div class="InputBox">
          <h4>Sending</h4>
          <BridgeAmountSelector v-model="amountToBridge" />
        </div>

        <FromTo
          :source="bs.bridge.snapshot.context.sourceNetwork"
          :destination="bs.bridge.snapshot.context.destinationNetwork"
        />
        <Button
          class="BridgeButton"
          variant="cta2"
          v-if='bs.bridge.snapshot.matches("READY")'
          @click='
            bs.bridge.send({
            	type: "StartOperation",
            	amount: (amountToBridge ?? 0).toString()
            })
          '
          :disabled="!amountToBridge || amountToBridge <= 0">
          Bridge
        </Button>
      </div>
      <div class="CurrentOperationWrapper" v-if="firstOperation">
        <ProgressBarWrapper :operation="firstOperation" />
        <Operation :operation="firstOperation" />
      </div>
    </div>
    <div class="RecentTransactions">
      <h3>Recent Transactions</h3>
      <BridgeOperations :operations="otherOperations" />
    </div>
  </div>
  <div class="Disabled" v-else>
    <p>
      The Rollup Bridge is a trustless bridge for transferring tokens from Mina
      L1 Devnet to Zeko L2 Testnet. Please check <a
        href="https://docs.zeko.io">Zeko Docs</a> for information about other
      bridges.
    </p>
    <p class="MainnetOnly" v-if='bs.currentNetwork.includes("mainnet")'>
      The Rollup Bridge is not available on Mainnet. Please
      <button @click='bs.bridge.send({ type: "SwitchToTesnet" })'>
        switch to a testnet
      </button>
      to start using the bridge.
    </p>
    <div class="WalletConnection" v-if="!bs.walletLoaded">
      <p>Please connect your wallet to start bridging.</p>
      <Button
        variant="auro"
        @click='bs.wallet.send({ type: "Connect" })'>Connect Wallet</Button>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
:deep(.InputBox) {
  display: grid;
  grid-template-columns: 20ch 1fr;
  align-items: center;
  @media (max-width: 1024px) {
    grid-template-columns: 10ch 1fr;
  }
}
.MainOperation {
  display: grid;
  grid-template-columns: auto auto;
  &.NoOperation {
    grid-template-columns: auto;
  }
  max-width: 100vw;
  @media (max-width: 1024px) {
    grid-template-columns: auto;
    gap: 2rem;
  }
}
.MainOperationInput {
  display: grid;
  gap: 1rem;
}
.BridgeButton {
  margin: 1rem;
}
.CurrentOperationWrapper {
  padding: 0 2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
}
.Disabled {
  text-align: center;
  button {
    width: fit-content;
  }
}
.MainnetOnly {
  button {
    all: unset;
    text-decoration: underline;
    color: blue;
    cursor: pointer;
  }
}
</style>
