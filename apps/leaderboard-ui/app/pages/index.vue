<template>
  <div class="Main">
    <Header />
    <LeaderboardTable />
    <Instructions />
    <Footer />
  </div>
</template>

<style lang="postcss" scoped>
.Main {
  display: flex;
  padding: 2.5rem 1rem;
  flex-direction: column;
  max-width: 100vw;
  gap: 4rem;
  @media (--small-desktop) {
    display: grid;
    padding: 2.5rem;
    grid-template-areas:
      "header header"
      "instructions table"
      "footer footer";
    grid-template-columns: minmax(auto, 34.25rem) 1fr;
    column-gap: 1.5rem;
  }
}
</style>
