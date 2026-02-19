<script lang="ts" setup>
const step = ref(0)
const increment = () => {
	if (step.value < 5) step.value++
}
const decrement = () => {
	if (step.value > 0) step.value--
}
const steps = ["a", "b", "c", "d"]
</script>
<template>
  <ProgressBar :steps :step />
  <hr>
  {{ steps.length }}
  steps, current step: {{ step }}
  <Button @click="decrement">-</Button>
  <Button @click="increment">+</Button>
</template>
