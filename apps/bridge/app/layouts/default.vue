<script lang="ts" setup>
import { theme } from "~~/helpers/theme"
const styles = theme
</script>

<template>
  <div class="page-background">
    <video class="background-video" autoplay loop muted playsinline>
      <source
        src="~/assets/videos/new_background_video.webm"
        type="video/webm"
      />
      Your browser does not support the video tag.
    </video>
    <div class="Layout" :style="styles.css.string">
      <slot />
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.page-background {
  position: relative;
  width: 100vw;
  max-width: 100vw;
  min-height: 100vh;
  overflow-x: hidden;
}

.background-video {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  z-index: -1;
}
</style>
