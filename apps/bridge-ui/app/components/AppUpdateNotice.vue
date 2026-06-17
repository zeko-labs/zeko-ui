<script setup lang="ts">
const updateStore = useServiceWorkerUpdateStore()
</script>

<template>
  <button
    v-if="updateStore.updateAvailable"
    type="button"
    class="AppUpdateNotice"
    :disabled="updateStore.isUpdating"
    @click="updateStore.update">
    <span>New version available</span>
    <strong>{{ updateStore.isUpdating ? "Updating..." : "Update now" }}</strong>
  </button>
</template>

<style lang="postcss" scoped>
.AppUpdateNotice {
  position: fixed;
  right: var(--page-padding);
  bottom: var(--page-padding);
  z-index: 20;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  max-width: min(28rem, calc(100vw - var(--page-padding) * 2));
  padding: 0.875rem 1rem;
  border: 1px solid var(--palette-cosmicGold-50);
  border-radius: 0.5rem;
  color: var(--palette-gray-950);
  background: oklch(1 0 0 / 0.92);
  box-shadow: 0 0.75rem 2rem oklch(0 0 0 / 0.18);
  cursor: pointer;
  font: inherit;
  text-align: left;

  span,
  strong {
    line-height: 1.2;
  }

  strong {
    white-space: nowrap;
    color: var(--palette-persianRed-600);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.8;
  }
}
</style>
