<template>
  <main>
    <header>
      <Navigation :logo="false" />
    </header>
    <section class="Hero">
      <!-- <Hero /> -->
    </section>
    <p>
      3 Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta. 3
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta.
    </p>
    <p>
      4 Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta. 4
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta.
    </p>
    <p>
      5 Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta. 5
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta.
    </p>
    <p>
      6 Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta. 6
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas,
      incidunt? Qui odio minus maxime ullam repellendus adipisci, sint alias
      deserunt a inventore aut at reiciendis quam, quia quidem modi soluta.
    </p>
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
  color: var(--colors-gray-950);
  font-size: var(--fonts-lexend-typescale-scale-xxl);
  padding: 0;
}

header {
  grid-area: nav;
  width: 100vw;
  height: 15vh;
}

.Hero {
  grid-area: hero;
  min-height: 75vh;
  width: 100vw;
}

footer {
  grid-area: footer;
  width: 100vw;
  background-color: var(--colors-gray-950);
  color: white;
}
</style>
