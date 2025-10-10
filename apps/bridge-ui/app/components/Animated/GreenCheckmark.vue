<script lang="ts" setup>
import {
	// biome-ignore lint/correctness/noUnusedImports: <explanation>
	DotLottieVue,
	type DotLottieVueInstance
} from "@lottiefiles/dotlottie-vue"

const playerRef = ref<DotLottieVueInstance>()
</script>
<template>
  <DotLottieVue
    ref="playerRef"
    renderer="svg"
    autoplay
    src="animations/green-checkmark.lottie"
  />
</template>
