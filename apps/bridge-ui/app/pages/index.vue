<script lang="ts" setup>
import { theme } from "@zeko/design"
const styles = theme
const steps = [
	"Send transfer request",
	"Sign send transaction",
	"Claim transfer",
	"Sign claim transaction",
	"Transfer complete"
]
const currentStepIndex = ref(0)
</script>

<template>
  <div class="wrapper">
    <div class="rollup-bridge" :style="styles.css.string">
      <header class="header">
        <div class="header-content">
          <div class="logo">
            <SvgZekoLogo />
          </div>
          <nav class="nav">
            <a href="#" class="nav-item">Build</a>
            <a href="#" class="nav-item">Community</a>
          </nav>
          <div class="user-menu">
            <!-- Implement user menu icon here -->
          </div>
        </div>
      </header>
      <main class="main-content">
        <h1 class="title">Rollup Bridge</h1>
        <p class="description">
          The Rollup Bridge is a trustless bridge for transferring tokens from
          Mina L1 to Zeko L2. Please check <a href="#" class="link">Zeko
            Docs</a>
          for information about other bridges.
        </p>
        <p class="instructions">
          Complete all steps to execute a rollup transfer between Mina L1 and
          Zeko L2
        </p>

        <div class="progress-bar">
          <ProgressBar :step="currentStepIndex" />
          <button
            @click="currentStepIndex--"
            :disabled="currentStepIndex === 0">
            Previous Step
          </button>
          <button
            @click="currentStepIndex++"
            :disabled="currentStepIndex === steps.length - 1">
            Next Step
          </button>
        </div>

        <hr />
        <TokenSelector />
        <hr />

        <FromTo />

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
      </main>
    </div>
  </div>
  <Wallet />
  <Bridge />
</template>

<style lang="postcss" scoped>
.wrapper {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  overflow-x: hidden;
}

.rollup-bridge {
  display: grid;
  grid-template-rows: auto 1fr;
  position: relative;
  min-height: 100vh;
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

.user-menu {
  width: 40px; /* Adjust based on your icon's dimensions */
  height: 40px;
  background-color: var(--colors-gray-900); /* Placeholder for the icon */
  border-radius: 50%;
}

main {
  padding: 0 1rem;
}
</style>
