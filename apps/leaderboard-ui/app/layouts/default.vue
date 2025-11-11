<template>
  <div class="page-background">
    <video class="desktop background-video" autoplay loop muted playsinline>
      <source src="~/assets/videos/looped_desktop.webm" type="video/webm">
      Your browser does not support the video tag.
    </video>
    <video class="mobile background-video" autoplay loop muted playsinline>
      <source src="~/assets/videos/looped_mobile.webm" type="video/webm">
      Your browser does not support the video tag.
    </video>
    <div class="Layout">
      <Navigation />
      <slot />
      <Footer />
    </div>
  </div>
</template>

<style lang="postcss">
:root {
  --page-padding: 2.5rem;
  @media not (--desktop) {
    --page-padding: 1rem;
  }
}
</style>

<style lang="postcss" scoped>
.page-background {
  position: relative;
  width: 100vw;
  min-height: 100vh;
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

.mobile {
  display: none;
}
.desktop {
  display: block;
}

@media not (--desktop) {
  .mobile {
    display: block;
  }
  .desktop {
    display: none;
  }
}

.Layout {
  position: relative;
  z-index: 0;
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}
</style>
