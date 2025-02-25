<script lang="ts" setup>
const ARevealed = ref(false)
const BRevealed = ref(false)
const CRevealed = ref(false)

const AClasses = computed(() => ({ Text: true, Revealed: ARevealed.value }))

const BClasses = computed(() => ({ Text: true, Revealed: BRevealed.value }))

const CClasses = computed(() => ({ Text: true, Revealed: CRevealed.value }))
</script>
<template>
  <div class="Wrapper">
    <div
      @mouseenter="(ARevealed = true)"
      @click="(ARevealed = !ARevealed)"
      :class="AClasses">
      Zero-knowledge is the technology of Trust, the foundation for building our
      future on blockchain
    </div>
    <div
      @mouseenter="(BRevealed = true)"
      @click="(BRevealed = !BRevealed)"
      :class="BClasses">
      zkApps like decentralized A.I. are natively scalable and modular,
      utilizing off-chain compute, storage, and data to augment UX and reduce
      costs
    </div>
    <div
      @mouseenter="(CRevealed = true)"
      @click="(CRevealed = !CRevealed)"
      :class="CClasses">
      Zeko Virtual Machine powers the future of decentralized apps with advanced
      programmability, cryptography, and automated agents
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Wrapper {
  grid-template-columns: repeat(3, 1fr);
  display: grid;
  gap: 2.5rem;
  margin: 0 auto;
  height: 100%;
  padding: 4rem;
  .Text {
    display: flex;
    padding: 2.25rem 2rem;
    justify-content: center;
    align-items: center;
    flex: 1 0 0;
    max-width: 50ch;
    border-radius: 1rem;
    background: var(--colors-gray-950);
    transition: background 0.25s linear;
    &.Revealed {
      background: white;
    }
  }
}
</style>
