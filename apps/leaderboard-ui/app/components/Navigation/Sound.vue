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
<style lang="postcss" scoped>
.Sound {
  --transition: transform 0.1s ease-in-out;
  width: 2rem;
  height: 2rem;
  background-color: black;
  border-radius: 50%;
  display: grid;
  place-items: center;
  transition: var(--transition);
  &:hover {
    background-color: var(--palette-cosmicGold-100);
    transform: scale(1.1);
    transition: var(--transition);
  }
  button {
    background: none;
    border: none;
    cursor: pointer;
  }
  svg {
    width: 85%;
    height: 85%;
  }
}
</style>
