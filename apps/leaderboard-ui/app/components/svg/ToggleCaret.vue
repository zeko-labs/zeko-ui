<template>
  <svg
    class="ToggleIcon"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true">
    <path
      d="M9 18L15 12L9 6"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
<style lang="postcss" scoped>
.ToggleIcon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  color: var(--palette-gray-600);
  transition: transform 0.2s ease;
  &.expanded {
    transform: rotate(90deg);
  }
}
</style>
