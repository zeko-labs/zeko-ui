<script lang="ts" setup>
const bs = useBridgeStore()
</script>
<template>
  <div class="Disabled">
    <p>
      The Rollup Bridge is a trustless bridge for transferring tokens from Mina
      L1 Devnet to Zeko L2 Testnet. Please check <a
        href="https://docs.zeko.io">Zeko Docs</a> for information about other
      bridges.
    </p>
    <div class="WalletConnection" v-if="!bs.walletLoaded">
      <p>Please connect your wallet to start bridging.</p>
      <Button
        variant="auro"
        @click='bs.wallet.send({ type: "Connect" })'>Connect Wallet</Button>
    </div>
    <p class="MainnetOnly" v-else-if='bs.currentNetwork.includes("mainnet")'>
      The Rollup Bridge is not available on Mainnet. Please
      <button @click='bs.bridge.send({ type: "SwitchToTesnet" })'>
        switch to a testnet
      </button>
      to start using the bridge.
    </p>
  </div>
</template>
<style lang="postcss" scoped>
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
.WalletConnection {
  display: grid;
  place-items: center;
}
</style>
