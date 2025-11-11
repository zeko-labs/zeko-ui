<script lang="ts" setup>
import { useMyCount } from "~/composables/useMyCount"

const { inc, dec, count } = useMyCount()
</script>

<template>
  <h2>Test</h2>
  <hr />
  {{ count }}
  <button @click="inc">Increment</button>
  <button @click="dec">Decrement</button>
</template>
