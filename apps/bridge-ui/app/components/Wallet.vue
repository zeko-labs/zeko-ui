<script lang="ts" setup>
const bs = useBridgeStore()
</script>

<template>
  <h2>Wallet</h2>
  <hr />
  {{ bs.wallet.snapshot.value }}
  {{ bs.wallet.snapshot.context }}
  <p>
    {{ bs.address }}
    {{ bs.displayAddress }} | {{ bs.wallet.snapshot.context?.currentNetwork }}
  </p>
  <fieldset>
    <label>
      <input name="testnet" type="checkbox" role="switch" checked disabled />
      Testnet
    </label>
  </fieldset>
  {{ bs.wallet.actorRef }}
  {{ bs.balances }}
  <!-- <hr /> -->
  <div v-if='bs.wallet.snapshot.matches("INIT")' role="group">
    <button @click='bs.wallet.send({ type: "Connect" })'>
      Connect
    </button>
  </div>
</template>
