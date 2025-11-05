<template>
  <footer>
    <div class="Content">
      <div class="Socials">
        <FooterSocial />
      </div>
    </div>
  </footer>
</template>
<style lang="postcss" scoped>
footer {
  grid-area: footer;
  position: relative;
  z-index: 1;
  max-width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: auto;
  padding: 4rem 1rem;
  @media not (--desktop) {
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
