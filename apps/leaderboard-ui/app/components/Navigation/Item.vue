<script setup lang="ts">
import { Menu } from "@ark-ui/vue/menu"

interface NavigationSection {
	name: string
	children: { name: string; url: string }[]
}

const { navigation } = defineProps<{ navigation: NavigationSection }>()
const isExternal = (url: string) => url.startsWith("http")
</script>

<template>
  <div class="NavigationItem">
    <ClientOnly>
      <Menu.Root>
        <Menu.Trigger>
          <span>{{ navigation.name }}</span>
          <Menu.Indicator as-child>
            <SvgCaretDown />
          </Menu.Indicator>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item
              v-for="item of navigation.children"
              :key="item.name"
              :value="item.name">
              <NuxtLink
                :to="item.url"
                :target='isExternal(item.url) ? "_blank" : undefined'>
                {{ item.name }}
              </NuxtLink>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </ClientOnly>
  </div>
</template>
<style lang="postcss" scoped>
.NavigationItem {
  padding: 0.75rem 1rem;
}

button {
  font-size: var(--typography_fluid-lexend-m);
  font-family: inherit;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--palette-gray-950);
  border: none;
  background: none;
  padding: 0;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    color: var(--palette-cosmicGold-100);
  }

  &:focus-visible {
    border-radius: 0.25rem;
  }

  span {
    padding: 0;
  }

  svg {
    transition: transform 0.2s ease-in-out;
  }

  &[data-state="open"] svg {
    transform: rotate(180deg);
  }
}

[data-scope="menu"][data-part="content"] {
  background-color: rgba(255, 255, 255, 1);
  backdrop-filter: blur(8px);
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  min-width: 12rem;
  animation: slideDown 0.2s ease-out;

  &[data-state="closed"] {
    animation: slideUp 0.2s ease-out;
  }
}

[data-scope="menu"][data-part="item"] {
  border-radius: 0.5rem;
  transition: background-color 0.2s ease-in-out;
  cursor: pointer;

  a {
    color: var(--palette-gray-950);
    font-size: var(--typography_fluid-lexend-s);
    text-decoration: none;
    font-weight: 500;
    outline: none;
    display: block;
    padding: 0.75rem 1rem;
    transition: color 0.2s ease-in-out;

    &:focus-visible {
      border-radius: 0.25rem;
    }
  }

  &[data-highlighted] {
    background-color: rgba(0, 0, 0, 0.04);

    a {
      color: var(--palette-cosmicGold-100);
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
}
</style>
