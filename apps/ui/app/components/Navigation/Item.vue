<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Menu } from "@ark-ui/vue/menu"
const { items } = defineProps<{ items: { name: string; url: string }[] }>()
const isExternal = (url: string) => url.startsWith("http")
</script>

<template>
  <div class="NavigationItem">
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
            v-for="item of items"
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
  </div>
</template>
<style lang="postcss" scoped>
button {
  font-size: var(--fonts-lexend-typescale-scale-m);
  font-family: inherit;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--colors-gray-950);
  border: none;
  background: none;
  padding: 0;
  outline: none;
  span {
    padding: 0;
  }
}
[data-scope="menu"][data-part="item"]{
    a {
        color: var(--colors-gray-950);
        font-size: var(--fonts-lexend-typescale-scale-s);
        text-decoration: none;
        font-weight: 500;
        outline: none;
    }
    &[data-highlighted]{
        a {
            color: var(--colors-cosmicGold-100);
        }
    }
}
@media (max-width: 1024px) {
  [data-scope="menu"][data-part="content"]{
    background-color: oklch(100 0 0 / 0.85);
    padding: 0.25rem;
    border-radius: 0.25rem;
  }
  [data-scope="menu"][data-part="item"]{
    a {
        font-size: var(--fonts-lexend-typescale-scale-xl);
    }
  }
}
</style>
