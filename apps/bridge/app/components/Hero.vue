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
  </div>
</template>
<style lang="postcss" scoped>
.Wrapper {
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100%;
  color: var(--colors-gray-950);
  font-size: var(--fonts-lexend-typescale-scale-m);
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
          text-wrap: balance;
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
</style>
