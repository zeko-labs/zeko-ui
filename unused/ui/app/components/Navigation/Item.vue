<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Menu } from "@ark-ui/vue/menu"
const { items } = defineProps<{ items: { name: string; url: string }[] }>()
const isExternal = (url: string) => url.startsWith("http")
</script>

<template>
  <div class="NavigationItem">
    <ClientOnly>
      <Menu.Root>
        <Menu.Trigger>
          <span>
            <slot />
          </span>
          <Menu.Indicator as-child>
            <SvgCaretDown />
          </Menu.Indicator>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item
              v-for="item in items"
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
  span {
    padding: 0;
  }
}
[data-scope="menu"][data-part="item"] {
  a {
    color: var(--palette-gray-950);
    font-size: var(--typography_fluid-lexend-s);
    text-decoration: none;
    font-weight: 500;
    outline: none;
  }
  &[data-highlighted] {
    a {
      color: var(--palette-cosmicGold-100);
    }
  }
}
@media (max-width: 1024px) {
  [data-scope="menu"][data-part="content"] {
    background-color: oklch(100 0 0 / 1);
    padding: 0.25rem;
    border-radius: 0.5rem;
  }
  [data-scope="menu"][data-part="item"] {
    a {
      font-size: var(--typography_fluid-lexend-l);
    }
  }
}
</style>
