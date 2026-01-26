<script lang="ts" setup>
const isOpen = ref(true)

function closePopup() {
	isOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="popup-overlay" @click.self="closePopup">
        <div class="popup-container">
          <!-- Close button -->
          <button
            class="close-button"
            aria-label="Close popup"
            @click="closePopup">
            ×
          </button>

          <!-- Zeko Logo -->
          <div class="logo-container">
            <SvgZekoBoom class="logo" />
          </div>

          <!-- Title -->
          <h1 class="title">Contest has Ended.</h1>

          <!-- Description -->
          <p class="description">
            The ZekoBoom Testnet Contest has concluded, with overwhelming
            community participation!
          </p>

          <!-- Stats Cards -->
          <div class="stats-container">
            <div class="stat-card">
              <div class="stat-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <span class="stat-value">+500K</span>
              <span class="stat-label">Txs on Zeko</span>
            </div>

            <div class="stat-card">
              <div class="stat-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <span class="stat-value">2,000%</span>
              <span class="stat-label">User Growth</span>
            </div>
          </div>

          <!-- Call to action text -->
          <p class="cta-text">
            Check out this page for your leaderboard stats and get ready for the
            zkInternet Revolution.
          </p>

          <!-- OK Button -->
          <button class="ok-button" @click="closePopup">OK</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="postcss" scoped>
.popup-overlay {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 80%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-size-5);
}

.popup-container {
  position: relative;
  background: linear-gradient(
    145deg,
    var(--palette-gray-950) 0%,
    var(--palette-basic-black) 100%
  );
  border: 1px solid var(--palette-alpha-soft-gray2);
  border-radius: 1.5rem;
  padding: 2.5rem 2rem;
  max-width: 600px;
  width: 100%;
  text-align: center;
  box-shadow:
    0 0 60px oklch(0% 0 0 / 50%),
    0 0 100px oklch(from var(--palette-cosmicGold-50) l c h / 5%);

  /* Subtle dot pattern overlay */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 1.5rem;
    background-image: radial-gradient(
      circle,
      oklch(from var(--palette-basic-white) l c h / 3%) 1px,
      transparent 1px
    );
    background-size: 20px 20px;
    pointer-events: none;
  }
}

.close-button {
  position: absolute;
  top: var(--spacing-size-5);
  right: var(--spacing-size-5);
  background: transparent;
  border: none;
  color: var(--palette-gray-500);
  font-size: 1.75rem;
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;

  &:hover {
    color: var(--palette-basic-white);
  }
}

.logo-container {
  margin-bottom: 1.5rem;
}

.logo {
  width: 120px;
  height: auto;
}

.title {
  font-size: var(--typography_fluid-lexend-h3);
  font-weight: var(--typography-weight-lexend-semibold);
  margin: 0 0 var(--spacing-size-5);
  background: var(--gradients-goldGradient-1);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;

  @media (--phone) {
    font-size: var(--typography_fluid-lexend-h4);
  }
}

.description {
  color: var(--palette-basic-white);
  font-size: var(--typography_fluid-lexend-l);
  line-height: 1.6;
  margin: 0 0 2rem;
  max-width: 480px;
  margin-inline: auto;

  @media (--phone) {
    font-size: var(--typography_fluid-lexend-m);
  }
}

.stats-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-size-5);
  margin-bottom: 1.5rem;

  @media (--phone) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: var(--palette-basic-black);
  border: 1px solid var(--palette-alpha-soft-gray2);
  border-radius: var(--spacing-size-5);
  padding: 1.5rem var(--spacing-size-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-size-2);
}

.stat-icon {
  color: var(--palette-basic-white);
  margin-bottom: var(--spacing-size-1);
}

.stat-value {
  font-size: var(--typography_fluid-lexend-xl);
  font-weight: var(--typography-weight-lexend-semibold);
  background: var(--gradients-goldGradient-3);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-label {
  color: var(--palette-gray-200);
  font-size: var(--typography_fluid-lexend-s);
}

.cta-text {
  color: var(--palette-gray-400);
  font-size: var(--typography_fluid-lexend-s);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.ok-button {
  background: var(--gradients-goldGradient-button-main);
  border: none;
  border-radius: var(--button-default-radius);
  padding: var(--button-default-padding);
  color: var(--palette-gray-950);
  font-size: var(--button-default-fontSize);
  font-weight: var(--button-default-fontWeight);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-width: var(--button-default-width);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px
      oklch(from var(--palette-cosmicGold-medium) l c h / 30%);
  }

  &:active {
    transform: translateY(0);
  }
}

/* Transition animation */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-active .popup-container,
.fade-leave-active .popup-container {
  transition: transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .popup-container,
.fade-leave-to .popup-container {
  transform: scale(0.95);
}
</style>
