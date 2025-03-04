<template>
  <div class="background">
    <img
      src="~/assets/images/problems-solutions/background.webp"
      alt="Background"
      class="background-image"
      loading="lazy"
    />
    <div class="circle-container top-left">
      <div class="circle-overlay">
        <img
          src="~/assets/images/problems-solutions/white_circles.webp"
          loading="lazy"
          alt="White Circles"
        />
      </div>
      <div class="text-container">
        <p>We live in a world of rapidly</p>
        <p>expanding technology</p>
        <p>and eroding TRUST</p>
      </div>
    </div>

    <div class="circle-container bottom-right">
      <div class="circle-overlay">
        <img
          src="~/assets/images/problems-solutions/white_circles.webp"
          loading="lazy"
          alt="White Circles"
        />
      </div>
      <div class="text-container">
        <p>Zeko is the privacy-preserving</p>
        <p>scalable operating system for the</p>
        <p>decentralized verified internet</p>
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
}

.background-image {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  object-fit: cover;
  z-index: 0;
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
  --size: 55vmax;
  width: var(--size);
  height: var(--size);
  top: -10vmax;
  left: 10vmax;
  z-index: 1;
}

.bottom-right { 
  --size: 65vmax;
  width: var(--size);
  height: var(--size);
  bottom: -20vmax;
  right: 0;
  z-index: 2;
}

@media (max-width: 1024px) {
  .top-left {
    --size: 54vmax;
    left: -10vmax;
  }
  .bottom-right {
    --size: 70vmax;
    right: -15vmax;
  }
}

.circle-overlay {
  position: absolute;
  animation: pulse 16s infinite;
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
    transform: scale(1.025);
  }
  100% {
    transform: scale(1);
  }
}
</style>
