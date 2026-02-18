<script lang="ts" setup>
import { Dialog, useDialog } from "@ark-ui/vue/dialog"

const { logo = true } = defineProps<{ logo?: boolean }>()

const {
	links: { zekoFaucet, zekoBridge, docs, zekoBoom },
	socials: { telegram, discord, twitter }
} = useRuntimeConfig().public

const navigation = [
	{
		name: "Build",
		children: [
			{ name: "Docs", url: docs },
			{ name: "Faucet", url: zekoFaucet },
			{ name: "Bridge", url: zekoBridge }
		]
	},
	{
		name: "Community",
		children: [
			{ name: "ZekoBoom", url: zekoBoom },
			{ name: "Discord", url: discord },
			{ name: "Telegram", url: telegram },
			{ name: "X (Twitter)", url: twitter }
		]
	}
]

const dialog = useDialog()

const closeMenu = () => {
	dialog.value.setOpen(false)
}

const openMenu = () => {
	dialog.value.setOpen(true)
}
</script>
<template>
  <div class="Header">
    <div class="Container">
      <NuxtLink to="/" class="LogoLink">
        <SvgZekoLogoRings v-if="logo" />
      </NuxtLink>

      <!-- Desktop Navigation -->
      <nav class="DesktopNav">
        <div class="NavItems">
          <NavigationItem
            v-for="section in navigation"
            :key="section.name"
            :navigation="section"
          />
        </div>
        <NavigationSound />
      </nav>

      <!-- Mobile Menu Toggle -->
      <button class="MenuToggle" @click="openMenu">
        <SvgHamburger />
      </button>

      <!-- Mobile Menu Dialog -->
      <Dialog.RootProvider :value="dialog">
        <Teleport to="body">
          <Dialog.Backdrop class="Backdrop" />
          <Dialog.Positioner class="Positioner">
            <Dialog.Content class="MobileContent">
              <div class="MobileHeader">
                <NuxtLink to="/" class="LogoLink" @click="closeMenu">
                  <SvgZekoLogoRings />
                </NuxtLink>
                <button class="MenuToggle" @click="closeMenu">
                  <SvgClose />
                </button>
              </div>

              <nav class="MobileNav">
                <div
                  v-for="section in navigation"
                  :key="section.name"
                  class="NavSection">
                  <h3 class="SectionTitle">{{ section.name }}</h3>
                  <ul class="NavList">
                    <li v-for="item in section.children" :key="item.name">
                      <NuxtLink
                        :to="item.url"
                        :target='item.url.startsWith("http") ? "_blank" : undefined'
                        @click="closeMenu">
                        {{ item.name }}
                      </NuxtLink>
                    </li>
                  </ul>
                </div>
              </nav>

              <div class="MobileFooter">
                <NavigationSound />
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Teleport>
      </Dialog.RootProvider>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Header {
  background: rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(4px);
  z-index: 3;
}

.Container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 3rem;
  gap: 1.5rem;
  &:has(a:hover) {
    .LogoLink svg {
      --transition: transform 0.15s ease-in-out;
      transition: var(--transition);
      &:hover {
        transition: var(--transition);
        transform: scale(1.05);
      }
    }
  }

  @media not (--desktop) {
    padding: 1rem 1.5rem;
  }
}

.LogoLink {
  display: grid;
  place-items: center;
  svg {
    width: 4.0625rem;
    height: 2.5rem;
    aspect-ratio: 13 / 8;
  }
}

.DesktopNav {
  display: flex;
  gap: 1.5rem;
  align-items: center;

  @media not (--desktop) {
    display: none;
  }
}

.NavItems {
  display: flex;
  align-items: center;
}

.MenuToggle {
  display: none;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  transition: opacity 0.2s ease-in-out;

  &:hover {
    opacity: 0.7;
  }

  &:focus-visible {
    outline: 1px solid var(--palette-cosmicGold-100);
    outline-offset: 2px;
    border-radius: 0.25rem;
  }

  @media not (--desktop) {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--palette-gray-950);
  }
}

.Backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
  animation: fadeIn 0.2s ease-in-out;

  &[data-state="closed"] {
    animation: fadeOut 0.2s ease-in-out;
  }

  &[aria-hidden="true"],
  &[data-aria-hidden="true"],
  &[hidden] {
    display: none;
  }
}

.Positioner {
  position: fixed;
  inset: 0;
  z-index: 101;
  overflow-y: auto;

  &[aria-hidden="true"],
  &[data-aria-hidden="true"],
  &[hidden] {
    display: none;
  }
}

.MobileContent {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 1);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.3s ease-out;

  &[data-state="closed"] {
    animation: slideOutRight 0.3s ease-out;
  }

  &[aria-hidden="true"],
  &[data-aria-hidden="true"],
  &[hidden] {
    display: none;
  }
}

.MobileHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
}

.MobileNav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3rem;
  padding: 2rem 1.5rem;
}

.NavSection {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.SectionTitle {
  font-size: var(--typography_fluid-lexend-xl);
  font-weight: 600;
  color: var(--palette-gray-950);
  margin: 0;
}

.NavList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  a {
    color: var(--palette-gray-700);
    text-decoration: none;
    font-size: var(--typography_fluid-lexend-l);
    font-weight: 500;
    transition: color 0.2s ease-in-out;
    display: block;
    padding: 0.5rem 0;

    &:hover {
      color: var(--palette-cosmicGold-100);
    }
  }
}

.MobileFooter {
  padding: 1.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}
</style>
