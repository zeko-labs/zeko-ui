<template>
  <footer>
    <div class="Content">
      <div class="Links">
        <NuxtLink to="/rules">Rules and Disclaimer</NuxtLink>
      </div>
      <hr>
      <div class="Socials">
        <FooterSocial />
      </div>
    </div>
  </footer>
</template>
<style lang="postcss" scoped>
footer {
  position: relative;
  z-index: 1;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: auto;
  padding: 2rem var(--page-padding);
  @media not (--desktop) {
    padding: 4rem var(--page-padding) 2.5rem;
  }
  :deep(a) {
    color: var(--palette-gray-700);
    text-decoration: none;
    :deep(svg) {
      height: 2.5rem;
      width: 2.5rem;
    }
  }
  .Content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;

    hr {
      display: block;
      border: none;
      width: 0.0625rem;
      height: 3rem;
      color: var(--palette-gray-200);
      background: var(--palette-gray-200);
      margin: 0 1.5rem;
    }
    @media not (--desktop) {
      flex-direction: column;
      hr {
        height: 0.0625rem;
        margin: 1rem 0;
        width: calc(100% - 2.5rem);
      }
    }
  }

  .Links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    font-size: var(--typography_fluid-lexend-m);
    @media not (--desktop) {
      padding: 0 1rem;
    }
    a {
      --transition: transform 0.15s ease-in-out;
      transition: var(--transition);
      &:hover {
        transform: scale(1.05);
      }
    }
  }

  .Socials {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    border-left: none;
    @media not (--desktop) {
      padding: 0 1rem;
    }
  }
}
</style>
