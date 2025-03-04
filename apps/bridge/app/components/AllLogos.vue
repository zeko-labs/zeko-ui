<template>
  <NuxtLink to="https://discord.gg/vSDxqAchUY" target="_blank ">
    <SvgSocialDiscord />
  </NuxtLink>
  <NuxtLink to="https://github.com/zeko-labs" target="_blank ">
    <SvgSocialGithub />
  </NuxtLink>
  <NuxtLink to="https://x.com/ZekoLabs" target="_blank ">
    <SvgSocialX />
  </NuxtLink>
  <NuxtLink to="https://t.me/zekoprotocol" target="_blank">
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
