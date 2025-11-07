<script setup lang="ts">
const { socials } = useRuntimeConfig().public
</script>

<template>
  <NuxtLink :to="socials.twitter" target="_blank ">
    <SvgSocialX />
  </NuxtLink>
  <NuxtLink :to="socials.telegram" target="_blank">
    <SvgSocialTelegram />
  </NuxtLink>
  <NuxtLink :to="socials.discord" target="_blank ">
    <SvgSocialDiscord />
  </NuxtLink>
  <NuxtLink :to="socials.github" target="_blank ">
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
