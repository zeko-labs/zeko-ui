<template>
  <main>
    <header>
      <Navigation :logo="false" />
    </header>
    <section class="Hero">
      <Hero />
    </section>
    <section class="ProblemSolution">
      <ProblemsAndSolution />
    </section>
    <section class="Feature">
      <Features />
    </section>
    <section class="Feature2">
      <Features2 />
    </section>
    <section class="Rings">
      <Rings />
    </section>
    <footer>
      <Footer />
    </footer>
  </main>
</template>
<style lang="postcss" scoped>
main {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto auto auto auto auto auto auto;
  grid-template-areas:
    "nav"
    "hero"
    "first"
    "second"
    "third"
    "rings"
    "footer";
  position: relative;
  min-height: 100svh;
  width: 100vw;
  color: var(--color-gray-950);
  font-size: var(--typography-lexend-m);
  padding: 0;
}
header {
  grid-area: nav;
  width: 100vw;
  height: 15svh;
}
.Hero {
  grid-area: hero;
  min-height: 85svh;
  width: 100vw;
}
.ProblemSolution {
  grid-area: first;
  background-color: var(--color-gray-950);
  color: white;
  width: 100vw;
  max-height: 100svh;
  aspect-ratio: 16/9;
}

@media (max-width: 1024px) {
  .ProblemSolution {
    height: 85svh;
  }
}
.Feature {
  grid-area: second;
  width: 100vw;
}

.Feature2 {
  grid-area: third;
  color: white;
  width: 100vw;
}

.Rings {
  grid-area: rings;
  width: 100vw;
  min-height: fit-content;
}

footer {
  grid-area: footer;
  width: 100vw;
  background-color: var(--color-gray-950);
  color: white;
}
</style>
