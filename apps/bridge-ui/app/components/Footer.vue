<template>
  <footer>
    <div class="Content">
      <div class="Links">
        <NuxtLink to="/privacy-policy">Privacy Policy</NuxtLink>
        <NuxtLink to="/terms-of-service">Terms of Service</NuxtLink>
      </div>
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
  max-width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: auto;
  padding: 4rem 1rem;
  @media (max-width: 1024px) {
    padding: 2rem 0.5rem;
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
    @media (max-width: 1024px) {
      display: grid;
      grid-template-rows: auto auto;
      gap: 1rem;
    }
  }

  .Links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    font-size: var(--typography_fluid-lexend-m);
    padding: 0 1rem;
    a {
      --transition: transform 0.15s ease-in-out;
      transition: var(--transition);
      &:hover {
        transform: scale(1.05);
        transition: var(--transition);
      }
    }
  }
  .Socials {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 0 1rem;
    border-left: 1px solid var(--palette-alpha-soft-gray1);
    @media (max-width: 1024px) {
      border-left: none;
    }
  }
}
</style>
