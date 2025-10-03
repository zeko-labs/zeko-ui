<script lang="ts" setup>
useHead({ title: "Zeko Bridge - Unsupported device" })
</script>

<template>
  <div class="Unsupported">
    <main>
      <h2>Mobile Disabled</h2>
      <p>
        Zeko Bridge isn't available on mobile yet. Please open this page on a
        desktop browser to continue.
      </p>
    </main>
  </div>
</template>

<style lang="postcss" scoped>
.Unsupported {
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: 0 var(--page-padding, 3rem);
}

main {
  display: grid;
  place-content: center;
  gap: 2rem;
  text-align: center;
  margin-inline: auto;
}

p {
  color: var(--palette-gray-700);
}
.Tip {
  color: var(--palette-gray-600);
  font: var(--typography_fluid-lexend-s);
}

footer {
  font-size: var(--typography_fluid-lexend-s);
  color: var(--palette-gray-500);
  padding: 4rem 1rem;
}
</style>
