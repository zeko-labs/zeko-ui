<script lang="ts" setup>
const { logo = true } = defineProps<{ logo?: boolean }>()
const {
	public: { telegram, discord, twitter }
} = useRuntimeConfig()
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
	{ name: "Discord", url: discord },
	{ name: "Telegram", url: telegram },
	{ name: "X (Twitter)", url: twitter }
]
</script>
<template>
  <div class="Header">
    <div class="Navigation">
      <div class="logo">
        <NuxtLink to="/">
          <SvgZekoLogoRings v-if="logo" />
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
    justify-content: flex-end;
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

.Sound, :deep(.Sound) {
  --transition: transform 0.1s ease-in-out;
  width: 2rem;
  height: 2rem;
  background-color: black;
  border-radius: 50%;
  display: grid;
  place-items: center;
  transition: var(--transition);
  &:hover {
    background-color: var(--colors-cosmicGold-100);
    transform: scale(1.1);
    transition: var(--transition);
  }
  button, :deep(button) {
    background: none;
    border: none;
    cursor: pointer;
  }
  svg, :deep(svg) {
    width: 85%;
    height: 85%;
  }
}
</style>
