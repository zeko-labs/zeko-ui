<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: vue-template
import { errorToaster } from "~/helpers"

const bs = useBridgeStore()
</script>
<template>
  <div class="Container">
    <div class="Content">
      <main>
        <h2>Zeko Bridge</h2>
        <Disabled
          v-if='
            bs.bridge.snapshot.matches("ERROR") ||
            bs.wallet.snapshot.matches("UNSUPPORTED") ||
            bs.currentNetwork.includes("mainnet") ||
            bs.wallet.snapshot.error ||
            (bs.address.length === 0 && bs.wallet.snapshot.matches("INIT"))
          '
        />
        <Bridge v-else />
        <Toast :toaster="errorToaster" />
      </main>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Container {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  padding: 0 var(--page-padding);
  display: grid;
  grid-template-rows: 1fr auto;
}

.Content {
  display: grid;
  gap: 2ch;
  grid-template-rows: auto 1fr;
  color: var(--palette-gray-950);
}

main {
  display: grid;
  gap: 4ch;
  h2 {
    text-align: center;
  }
}

footer {
  font-size: var(--typography_fluid-lexend-s);
  color: var(--palette-gray-500);
  padding: 4rem 1rem;
  /* Tablet & Desktop */
  @media (min-width: 480px) {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
  }
}
</style>
