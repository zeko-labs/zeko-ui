<template>
  <div class="LoadingBar"></div>
</template>
<style lang="postcss" scoped>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.LoadingBar {
  position: relative;
  width: 7.5rem;
  height: 1rem;
  border-radius: 6.25rem;
  background: linear-gradient(
    90deg,
    rgba(217, 217, 217, 0.72) 0%,
    rgba(217, 217, 217, 0.00) 100%
  );
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 100%
    );
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
      display: none;
    }
  }
}
</style>
