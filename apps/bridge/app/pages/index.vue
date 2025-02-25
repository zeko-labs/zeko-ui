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
  min-height: 100dvh;
  width: 100vw;
  color: var(--colors-gray-950);
  font-size: var(--fonts-lexend-typescale-scale-m);
  padding: 0;
}
header {
  grid-area: nav;
  width: 100vw;
}
.Hero {
  grid-area: hero;
  min-height: 100dvh;
  width: 100vw;
}
.ProblemSolution {
  grid-area: first;
  background-color: var(--colors-gray-950);
  color: white;
  min-height: 40rem;
  height: 100dvh;
  width: 100vw;
}
.Feature {
  grid-area: second;
  height: 22.125rem;
  width: 100vw;
}
.Feature2 {
  grid-area: third;
  color: white;
  height: 30rem;
  width: 100vw;
}
.Rings {
  grid-area: rings;
  width: 100vw;
  height: 60rem;
}
footer {
  grid-area: footer;
  width: 100vw;
  background-color: var(--colors-gray-950);
  color: white;
}
</style>
