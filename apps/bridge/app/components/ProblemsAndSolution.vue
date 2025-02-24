<template>
  <div class="background">
    <div class="circle-container top-left">
      <div class="circle-overlay"></div>
      <div class="yellow-glow"></div>
      <div class="text-container">
        <p>We live in a world of rapidly</p>
        <p>expanding technology</p>
        <p>and eroding trust</p>
      </div>
    </div>

    <div class="circle-container bottom-right">
      <div class="circle-overlay"></div>
      <div class="yellow-glow"></div>
      <div class="text-container">
        <p>Zeko is the privacy-preserving</p>
        <p>scalable operating system for the</p>
        <p>New Internet revolution</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
	name: "CircleTextComponent"
}
</script>

<style lang="postcss" scoped>
.background {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.circle-container {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
}

.top-left {
  width: 40vw;
  height: 40vw;
  top: -10vw;
  left: 10vw;
  z-index: 1;
}

.bottom-right { 
  width: 60vw;
  height: 60vw;
  bottom: -20vw;
  right: 0;
  z-index: 2;
}

.circle-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background-image: url("~/assets/images/white_circles.png");
  background-size: cover;
  background-position: center;
  opacity: 0.75;
  border-radius: 50%;
}

.yellow-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 200, 0.25) 0%, rgba(255, 240, 150, 0.05) 40%, transparent 70%);
  z-index: 2;
}

.text-container {
  position: relative;
  z-index: 3;
  text-align: center;
  max-width: 80%;
}
</style>
