<template>
  <a href="#" class="nav-item">
    <slot />
    <SvgCaretDown />
  </a>
</template>
<style lang="postcss" scoped>
a {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}
.nav-item {
  color: var(--colors-gray-950);
  text-decoration: none;
  font-size: 1rem;
  font-weight: 500;
}
</style>
