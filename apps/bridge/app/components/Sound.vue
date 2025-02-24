<script lang="ts" setup>
const isMuted = ref(true)
const audio = new Audio("/background.mp3")
const play = () => {
	if (isMuted.value) audio.play()
	else audio.pause()
	isMuted.value = !isMuted.value
}
onMounted(() => {
	audio.loop = true
})
</script>
<template>
  <div class="Sound">
    <button @click="play">
      <SvgSpeaker :is-muted="isMuted" />
    </button>
  </div>
</template>
