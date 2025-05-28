<template>
  <NuxtLink :to="$config.public.discord" target="_blank ">
    <SvgSocialDiscord />
  </NuxtLink>
  <NuxtLink :to="$config.public.github" target="_blank ">
    <SvgSocialGithub />
  </NuxtLink>
  <NuxtLink :to="$config.public.twitter" target="_blank ">
    <SvgSocialX />
  </NuxtLink>
  <NuxtLink :to="$config.public.telegram" target="_blank">
    <SvgSocialTelegram />
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
