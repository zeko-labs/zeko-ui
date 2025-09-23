<template>
  <div class="Container">
    <div class="Content">
      <Header />
      <main>
        <h2>Zeko Bridge</h2>
        <Bridge />
      </main>
    </div>
    <Footer />
  </div>
  <!-- <div>
    <hr />

    <Button variant="cta1">Connect Wallet</Button>
    <Button variant="cta2">Send</Button>
    <Button variant="cta3">Claim</Button>
    <Button variant="cta1" disabled>Disabled</Button>

    <hr />
    <Button>Default</Button>
    <Button>Add Token</Button>
    <Button disabled>Add Token</Button>
    <hr />

    <Label is="pending" />
    <Label is="complete" />
  </div> -->
</template>
<style lang="postcss" scoped>
.Container {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  overflow-x: hidden;
  padding: 0 var(--page-padding);
  display: grid;
  grid-template-rows: auto 1fr;
}

.Content {
  display: grid;
  gap: 2ch;
  grid-template-rows: auto 1fr;
  position: relative;
  color: var(--palette-gray-950);
}

main {
  display: grid;
  gap: 4ch;
  h2 {
    text-align: center;
  }
}

footer {
  font-size: var(--typography_fluid-lexend-s);
  color: var(--palette-gray-500);
  padding: 4rem 1rem;
  /* Tablet & Desktop */
  @media (min-width: 480px) {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
  }
}
</style>
