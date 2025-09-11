<script setup>
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import * as Sentry from "@sentry/nuxt"
function triggerClientError() {
	throw new Error("Nuxt Button Error")
}
</script>
<template>
  <button id="errorBtn" @click="triggerClientError">
    Throw Client Error
  </button>
</template>
