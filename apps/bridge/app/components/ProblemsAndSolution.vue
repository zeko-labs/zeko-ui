<template>
  <div class="background">
    <div class="circle-container top-left">
      <div class="circle-overlay">
        <img
          src="~/assets/images/problems-solutions/white_circles.svg"
          alt="White Circles"
        />
      </div>
      <div class="text-container">
        <p>We live in a world of rapidly</p>
        <p>expanding technology</p>
        <p>and eroding trust</p>
      </div>
    </div>

    <div class="circle-container bottom-right">
      <div class="circle-overlay">
        <img
          src="~/assets/images/problems-solutions/white_circles.svg"
          alt="White Circles"
        />
      </div>
      <div class="text-container">
        <p>Zeko is the privacy-preserving</p>
        <p>scalable operating system for the</p>
        <p>New Internet revolution</p>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.background {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background-image: url("~/assets/images/problems-solutions/background.svg");
  background-size: cover;
}

.circle-container {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0.9;
  &:hover {
    opacity: 1;
  }
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
  border-radius: 50%;
  animation: pulse 4s infinite;
}

.text-container {
  position: relative;
  z-index: 3;
  text-align: center;
  max-width: 80%;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
</style>
