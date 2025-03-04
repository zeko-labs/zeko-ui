<template>
  <div class="Wrapper">
    <div class="Content">
      <div class="Logo">
        <SvgZekoLogoRings />
      </div>
      <div class="Main">
        <div class="Text">
          <div class="Title">Powering the <b>zkInternet Revolution</b></div>
          <div class="Description">
            Zeko is a decentralized <b>zero-knowledge scaling protocol</b>
            powering the future of the Internet, AI., Gaming, and Finance
          </div>
        </div>
        <div class="Buttons">
          <NuxtLink
            to="https://docs.zeko.io"
            target="_blank">
            <Button variant="cta1">Start Building</Button>
          </NuxtLink>
          <NuxtLink to="/faucet">
            <Button variant="cta1">Testnet Contest</Button>
          </NuxtLink>
        </div>
      </div>
    </div>
    <div class="SocialLinks">
      <AllLogos />
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Wrapper {
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100%;
  color: var(--colors-gray-950);
  font-size: var(--fonts-lexend-typescale-scale-m);
}

@media (max-width: 1024px) {
  .Wrapper {
    padding: 0;
  }
}

.Content {
  display: flex;
  padding: 8.75rem 4rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 3.5rem;
  align-self: stretch;
}

@media (max-width: 1024px) {
  .Content {
    padding: 0 1rem;
    align-items: center;
    max-width: 100vw;
  }
}

.Logo {
  height: 3rem;
}

.Main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2.5rem;
  align-self: stretch;
}

@media (max-width: 1024px) {
  .Main {
    align-items: center;
    align-self: center;
  }
}

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
    text-wrap: balance;
    color: var(--colors-gray-700);
    font-size: var(--fonts-lexend-typescale-scale-m);
    font-weight: 300;
    line-height: 155%;
    b {
      font-weight: 500;
    }
  }
}

@media (max-width: 1024px) {
  .Text {
    align-items: center;
    justify-content: center;
    text-align: center;
    text-wrap: balance;
    .Title {
      font-size: var(--fonts-lexend-typescale-scale-xxl);
    }
    .Description {
      width: auto;
    }
  }
}

.Buttons {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}
@media (max-width: 1024px) {
  .Buttons {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    button {
      width: 15ch;
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
  :deep(a) {
    color: var(--colors-gray-950);
    &:hover {
      transform: scale(1.2);
    }
  }
}

@media (max-width: 1024px) {
  .SocialLinks {
    display: inline-flex;
    justify-content: center;
  }
}
</style>
