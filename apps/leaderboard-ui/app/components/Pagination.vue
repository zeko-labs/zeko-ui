<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-vue-next"

const lb = useLeaderboard()
</script>
<template>
  <div class="Pagination">
    <nav
      class="PaginationBar"
      aria-label="Pagination"
      aria-controls="bridge-operations-table">
      <button
        class="PageButton PrevNext"
        :disabled="lb && lb.page <= 1"
        @click="lb.goPrev"
        aria-label="Go to previous page">
        <ChevronLeftIcon />
      </button>
      <button
        class="PageButton PrevNext"
        :disabled="!lb.hasMore"
        @click="lb.goNext"
        aria-label="Go to next page">
        <ChevronRightIcon />
      </button>
    </nav>
  </div>
</template>
<style lang="postcss" scoped>
nav {
  display: flex;
  align-items: center;
  font-size: var(--typography_fluid-lexend-s);
  border: 1px solid var(--theme-light-border-secondary);
  border-radius: 0.5rem;
  width: fit-content;
}

.PageButton {
  --bg: white;
  --fg: var(--theme-light-content-primary);
  --bd: var(--palette-gray-200);
  min-width: 2.5rem;
  block-size: 2.5rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-inline-end: 1px solid var(--bd);
  border-radius: 0;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  font-weight: 400;
  transition: background-color 120ms ease;
  &.active {
    --bg: var(--palette-gray-100);
    font-weight: 600;
    border-inline: 1px solid var(--bd);
  }
  &.PrevNext {
    &:hover:not([disabled]) {
      --bg: var(--bridge-bg-alt);
    }
    &:first-child {
      border-start-start-radius: 0.5rem;
      border-end-start-radius: 0.5rem;
    }
    &:last-child {
      border-inline-end: none;
      border-start-end-radius: 0.5rem;
      border-end-end-radius: 0.5rem;
    }
  }
  &:hover:not([disabled]):not(.active) {
    --bg: var(--bridge-bg-alt);
  }
  &:focus-visible {
    outline: 2px solid var(--bridge-focus-color);
    outline-offset: -2px;
    z-index: 1;
  }
  &[disabled] {
    opacity: 0.3;
    cursor: not-allowed;
  }
  svg {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }
}
</style>
