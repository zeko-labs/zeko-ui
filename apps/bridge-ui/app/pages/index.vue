<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Wallet as WalletIcon } from "lucide-vue-next"
const bs = useBridgeStore()
const currentMina = computed(() => {
	return Number.parseFloat(
		bs.balances[bs.currentNetwork]?.MINA?.balance.toFixed(3) ?? "0"
	).toString()
})
</script>
<template>
  <div class="wrapper">
    <div class="rollup-bridge">
      <header class="header">
        <div class="header-content">
          <div class="logo">
            <SvgZekoLogoRings />
          </div>
          <nav class="nav">
            <!-- <a href="#" class="nav-item">Build</a> -->
            <!-- <a href="#" class="nav-item">Community</a> -->
          </nav>

          <div class="Wallet">
            <div class="Mina">
              <span>
                {{ currentMina }}
              </span>
              <SvgMinaToken width="24" height="24" />
            </div>
            <div class="Network">
              <NetworkTarget :network="bs.currentNetwork" />
            </div>
            <div class="Address" :title="bs.address">
              <WalletIcon />
              <span>
                {{ bs.displayAddress }}
              </span>
            </div>
          </div>
        </div>
      </header>
      <main class="main-content">
        <h1 class="title">Zeko Bridge</h1>
        <hr>
        <Bridge />
      </main>
    </div>
    <footer>© {{ new Date().getFullYear() }} Zeko</footer>
  </div>
  <!-- <div>
    <hr />

    <Button variant="cta1">Connect Wallet</Button>
    <Button variant="cta2">Send</Button>
    <Button variant="cta3">Claim</Button>
    <Button variant="cta1" disabled>Disabled</Button>

    <hr />
    <Button>Default</Button>
    <Button>Add Token</Button>
    <Button disabled>Add Token</Button>
    <hr />

    <Label is="pending" />
    <Label is="complete" />
  </div>
  <Wallet /> -->
</template>
<style lang="postcss" scoped>
.wrapper {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  overflow-x: hidden;
  padding: 0 4rem;
  display: grid;
  grid-template-rows: auto 1fr;
}

.rollup-bridge {
  display: grid;
  grid-template-rows: auto 1fr;
  position: relative;
  color: var(--colors-gray-950);
}

.header {
  background: rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(4px);
}

.header-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  margin: 0;
  padding: 1rem 2rem;
  gap: 24px;
}

.logo {
  width: 79px;
  height: 48px;
}

.nav {
  justify-self: flex-end;
  display: flex;
  gap: 2rem;
}

.nav-item {
  color: var(--colors-gray-950);
  text-decoration: none;
  font-size: 1rem;
  font-weight: 500;
}

.Wallet {
  display: flex;
  gap: 1ch;
  div {
    display: flex;
    align-items: center;
  }
  .Mina {
    gap: 0.5ch;
  }
  .Address {
    gap: 0.5ch;
  }
}

main {
  padding: 0 1rem;
}

footer {
  font-size: var(--fonts-lexend-typescale-scale-s);
  color: var(--colors-gray-500);
  padding: 4rem 0 4rem 0;
  /* Tablet & Desktop */
  @media (min-width: 480px) {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
  }
}
</style>
