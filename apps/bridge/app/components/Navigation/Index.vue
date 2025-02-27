<script lang="ts" setup>
const { logo = true } = defineProps<{ logo?: boolean }>()
const buildItems = [
	{
		name: "Docs",
		url: "https://docs.zeko.io"
	},
	{
		name: "Faucet",
		url: "/faucet"
	}
]

const communityItems = [
	{
		name: "Discord",
		url: "https://discord.gg/vSDxqAchUY"
	},
	{
		name: "Telegram",
		url: "https://t.me/+m8LBsR2kNTAxNmFh"
	},
	{
		name: "X (Twitter)",
		url: "https://twitter.com/ZekoLabs"
	}
]
</script>
<template>
  <div class="Header">
    <div class="Navigation">
      <div class="logo">
        <NuxtLink to="/">
          <SvgZekoLogo v-if="logo" />
        </NuxtLink>
      </div>
      <nav class="nav">
        <NavigationItem :items="buildItems">Build</NavigationItem>
        <NavigationItem :items="communityItems">Community</NavigationItem>
        <ClientOnly>
          <Sound />
          <template #fallback>
            <div class="Sound">
              <button>
                <SvgSpeaker :is-muted="true" />
              </button>
            </div>
          </template>
        </ClientOnly>
      </nav>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Header {
  background: rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(4px);
}

.Navigation {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  margin: 0;
  padding: 2.5rem 4rem;
  gap: 24px;
  min-height: 10svh;
}

@media (max-width: 1024px) {
  .Navigation {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    margin: auto;
    padding: 0;
    .logo {
      display: none;
      grid-template-columns: auto 1fr auto;
    }
  }
}

.logo {
  width: 79px;
  height: 48px;
}

.nav {
  justify-self: flex-end;
  display: flex;
  align-items: center;
  gap: 2rem;
}

@media (max-width: 1024px) {
  .nav {
   justify-self: center;
  }
}

.Sound, :deep(.Sound){
  width: 40px;
  height: 40px;
  background-color: black;
  border-radius: 50%;
  display: grid;
  place-items: center;
  button, :deep(button) {
    background: none;
    border: none;
    cursor: pointer;
  }
}
</style>
