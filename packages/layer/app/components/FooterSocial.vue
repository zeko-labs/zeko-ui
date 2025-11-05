<script setup lang="ts">
const config = useRuntimeConfig().public
</script>

<template>
  <NuxtLink :to="config.twitter" target="_blank ">
    <SvgSocialX />
  </NuxtLink>
  <NuxtLink :to="config.telegram" target="_blank">
    <SvgSocialTelegram />
  </NuxtLink>
  <NuxtLink :to="config.discord" target="_blank ">
    <SvgSocialDiscord />
  </NuxtLink>
  <NuxtLink :to="config.github" target="_blank ">
    <SvgSocialGithub />
  </NuxtLink>
</template>
<style lang="postcss" scoped>
a {
  --transition: transform 0.15s ease-in-out;
  transition: var(--transition);
  &:hover {
    transform: scale(1.2);
    transition: var(--transition);
  }
}
</style>
