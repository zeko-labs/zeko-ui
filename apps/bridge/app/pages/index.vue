<template>
  <main>
    <header>
      <Navigation :logo="false" />
    </header>
    <section class="Hero">
      <div class="Content">
        <div class="Logo">
          <SvgZekoLogoRings />
        </div>
        <div class="Main">
          <div class="Text">
            <div class="Title">Powering the <b>zkInternet Revolution</b></div>
            <div class="Description">
              Zeko is a decentralized <b>zero-knowledge scaling protocol</b>
              powering the future of the Internet, A.I., Gaming, and Finance
            </div>
          </div>
          <div class="Buttons">
            <Button variant="cta1">Start Building</Button>
            <Button variant="cta1">Testnet Contest</Button>
          </div>
        </div>
      </div>
      <div class="SocialLinks">
        <a href="https://discord.gg/vSDxqAchUY" target="_blank">
          <SvgSocialDiscord />
        </a>
        <a href="https://github.com/zeko-labs" target="_blank">
          <SvgSocialGithub />
        </a>
        <a href="https://t.me/zekoprotocol" target="_blank">
          <SvgSocialTelegram />
        </a>
        <a href="https://x.com/ZekoLabs" target="_blank">
          <SvgSocialX />
        </a>
      </div>
    </section>
    <section class="ProblemSolution">
      <ProblemsAndSolution />
    </section>
    <section class="Feature">
      <div class="Text">
        Zero-knowledge is the technology of Trust, the foundation for building
        our future on blockchain
      </div>
      <div class="Text">
        zkApps like decentralized A.I. are natively scalable and modular,
        utilizing off-chain compute, storage, and data to augment UX and reduce
        costs
      </div>
      <div class="Text">
        Zeko Virtual Machine powers the future of decentralized apps with
        advanced programmability, cryptography, and automated agents
      </div>
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
  display: grid;
  grid-template-rows: 1fr auto;
  .Content {
    display: flex;
    padding: 8.75rem 4rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 3.5rem;
    align-self: stretch;
    .Main {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2.5rem;
      align-self: stretch;
      .Text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
        align-self: stretch;
        .Title {
          font-size: var(--fonts-lexend-typescale-scale-h3);
          font-weight: 500;
          b {
            font-weight: 600;
          }
        }
        .Description {
          width: 50ch;
          font-size: var(--fonts-lexend-typescale-scale-m);
          font-weight: 300;
          b {
            font-weight: 500;
          }
        }
      }
      .Buttons {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
      }
    }
  }
  .SocialLinks {
    display: flex;
    padding: 2.5rem 4rem;
    justify-content: flex-end;
    align-items: center;
    gap: 1.5rem;
    background: rgba(255, 255, 255, 0.24);
    backdrop-filter: blur(2px);
    a {
      color: var(--colors-gray-950);
      &:hover {
        transform: scale(1.2);
      }
    }
  }
}
.ProblemSolution {
  grid-area: first;
  background-color: var(--colors-gray-950);
  color: white;
  height: 50rem;
  width: 100vw;
}
.Feature {
  grid-area: second;
  grid-template-columns: repeat(3, auto);
  display: grid;
  height: 22.125rem;
  padding: 4rem;
  gap: 2.5rem;
  margin: 0 auto;
  width: 100vw;
  .Text {
    display: flex;
    padding: 2.25rem 2rem;
    justify-content: center;
    align-items: center;
    flex: 1 0 0;
    max-width: 50ch;
    border-radius: 1rem;
    background: white;
  }
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
