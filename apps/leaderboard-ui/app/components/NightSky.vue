<script setup lang="ts">
const generateStars = (count: number) =>
	Array.from({ length: count }, () => ({
		left: Math.random() * 100,
		top: Math.random() * 100,
		delay: Math.random() * 5,
		size: Math.random()
	}))

const smallStars = generateStars(200)
const mediumStars = generateStars(100)
const largeStars = generateStars(50)
const twinkleStars = generateStars(30)
</script>

<template>
  <div class="NightSky">
    <div class="GradientBg" />
    <div class="StarsContainer">
      <div
        v-for="(star, index) of smallStars"
        :key="`small-${index}`"
        class="Star Small"
        :style="
          {
          	left: `${star.left}%`,
          	top: `${star.top}%`,
          	animationDelay: `${star.delay}s`
          }
        "
      />
      <div
        v-for="(star, index) of mediumStars"
        :key="`medium-${index}`"
        class="Star Medium"
        :style="
          {
          	left: `${star.left}%`,
          	top: `${star.top}%`,
          	animationDelay: `${star.delay}s`
          }
        "
      />
      <div
        v-for="(star, index) of largeStars"
        :key="`large-${index}`"
        class="Star Large"
        :style="
          {
          	left: `${star.left}%`,
          	top: `${star.top}%`,
          	animationDelay: `${star.delay}s`
          }
        "
      />
      <div
        v-for="(star, index) of twinkleStars"
        :key="`twinkle-${index}`"
        class="Star Twinkle"
        :style="
          {
          	left: `${star.left}%`,
          	top: `${star.top}%`,
          	animationDelay: `${star.delay}s`,
          	animationDuration: `${2 + star.size * 3}s`
          }
        "
      />
    </div>
    <div class="NebulaLayer" />
  </div>
</template>

<style lang="postcss" scoped>
.NightSky {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.GradientBg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse at top left,
      oklch(0.3 0.06 90) 0%,
      oklch(0.24 0.045 85) 20%,
      oklch(0.18 0.03 80) 40%,
      transparent 70%
    ),
    linear-gradient(
    to bottom,
    oklch(0.08 0.01 250) 0%,
    oklch(0.1 0.01 250) 50%,
    oklch(0.12 0.01 250) 100%
  );
}

.StarsContainer {
  position: absolute;
  inset: 0;
}

.Star {
  position: absolute;
  background-color: oklch(1 0 0);
  border-radius: 50%;
  opacity: 0.8;
  &.Small {
    width: 1px;
    height: 1px;
    animation: twinkle-subtle 3s ease-in-out infinite;
  }
  &.Medium {
    width: 1.5px;
    height: 1.5px;
    animation: twinkle-subtle 4s ease-in-out infinite;
  }
  &.Large {
    width: 2px;
    height: 2px;
    box-shadow: 0 0 4px 1px oklch(1 0 0 / 0.3);
    animation: twinkle-subtle 5s ease-in-out infinite;
  }
  &.Twinkle {
    width: 2px;
    height: 2px;
    box-shadow: 0 0 6px 2px oklch(1 0 0 / 0.5);
    animation: twinkle-bright 3s ease-in-out infinite;
  }
}

.NebulaLayer {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse at 20% 30%,
      oklch(0.25 0.03 70 / 0.12) 0%,
      transparent 50%
    ),
    radial-gradient(
    ellipse at 80% 50%,
    oklch(0.27 0.035 65 / 0.08) 0%,
    transparent 50%
  ),
    radial-gradient(
    ellipse at 40% 70%,
    oklch(0.3 0.04 60 / 0.06) 0%,
    transparent 40%
  );
  opacity: 0.5;
  animation: nebula-drift 60s ease-in-out infinite;
}

@keyframes twinkle-subtle {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes twinkle-bright {
  0%,
  100% {
    opacity: 0.6;
    box-shadow: 0 0 4px 1px oklch(1 0 0 / 0.3);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 8px 3px oklch(1 0 0 / 0.7);
  }
}

@keyframes nebula-drift {
  0%,
  100% {
    transform: translateX(0) scale(1);
  }
  50% {
    transform: translateX(2%) scale(1.05);
  }
}
</style>
