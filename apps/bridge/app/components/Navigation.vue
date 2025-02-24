<script lang="ts" setup>
const { logo } = defineProps<{ logo: boolean }>()
</script>
<template>
  <div class="Header">
    <div class="Navigation">
      <div class="logo">
        <SvgZekoLogo v-if="logo" />
      </div>
      <nav class="nav">
        <NavItem>Build</NavItem>
        <NavItem>Community</NavItem>
      </nav>
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
  grid-template-columns: auto 1fr auto;
  align-items: center;
  margin: 0;
  padding: 2.5rem 4rem;
  gap: 24px;
  min-height: 10dvh;
}

.logo {
  width: 79px;
  height: 48px;
}

.nav {
  justify-self: flex-end;
  display: flex;
  gap: 2rem;
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
