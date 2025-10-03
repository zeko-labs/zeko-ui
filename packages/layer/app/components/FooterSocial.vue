<script setup lang="ts">
const config = {
	telegram: "https://t.me/zekoprotocol",
	discord: "https://discord.gg/vSDxqAchUY",
	twitter: "https://twitter.com/ZekoLabs",
	github: "https://github.com/zeko-labs"
}
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
