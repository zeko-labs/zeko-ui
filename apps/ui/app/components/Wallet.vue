<script lang="ts" setup>
const store = useWalletStore()
const { address, displayAddress, snapshot, actorRef, minaBalances } =
	storeToRefs(store)
</script>

<template>
  <h2>Wallet</h2>
  <hr />
  {{ snapshot.value }}
  {{ snapshot.context }}
  <p>
    {{ address }} {{ displayAddress }} | {{ snapshot.context?.currentNetwork }}
  </p>
  <fieldset>
    <label>
      <input name="testnet" type="checkbox" role="switch" checked disabled />
      Testnet
    </label>
  </fieldset>
  {{ actorRef }}
  {{ minaBalances }}
  <!-- <hr /> -->
  <div v-if='snapshot.matches("INIT")' role="group">
    <button @click='store.send({ type: "Connect" })'>
      Connect
    </button>
  </div>
</template>
