<template>
  <div class="Container">
    <div class="Content">
      <header class="header">
        <div class="header-content">
          <div class="logo">
            <SvgZekoLogoRings />
          </div>
          <nav class="nav">
            <!-- <a href="#" class="nav-item">Build</a> -->
            <!-- <a href="#" class="nav-item">Community</a> -->
          </nav>
          <Wallet />
        </div>
      </header>
      <main>
        <h2>Zeko Bridge</h2>
        <Bridge />
      </main>
    </div>
    <footer>© {{ new Date().getFullYear() }} Zeko</footer>
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
  padding: 0 4rem;
  display: grid;
  grid-template-rows: auto 1fr;
  @media (max-width: 1024px) {
    padding: 0rem;
  }
}

.Content {
  display: grid;
  gap: 2ch;
  grid-template-rows: auto 1fr;
  position: relative;
  color: var(--colors-gray-950);
}

.header {
  background: rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(4px);
}

.header-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  margin: 0;
  padding: 1rem 2rem;
  gap: 1rem;
}

.logo {
  width: 79px;
  height: 48px;
}

.nav {
  justify-self: flex-end;
  display: flex;
  gap: 2rem;
}

.nav-item {
  color: var(--colors-gray-950);
  text-decoration: none;
  font-size: 1rem;
  font-weight: 500;
}

main {
  display: grid;
  gap: 4ch;
  padding: 0 1rem;
  h2 {
    text-align: center;
  }
}

footer {
  font-size: var(--fonts-lexend-typescale-scale-s);
  color: var(--colors-gray-500);
  padding: 4rem 1rem;
  /* Tablet & Desktop */
  @media (min-width: 480px) {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
  }
}
</style>
