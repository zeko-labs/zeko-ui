<template>
  <div class="background">
    <SvgZekoBigRings class="background-image" />
    <div class="Nodes">
      <div class="Node Connection" ref="Connection">
        <div class="Picture">
          <img
            class="Hovered"
            src="~/assets/images/rings/Connection2.svg"
            alt="Connection">
          <img
            class="NotHovered"
            src="~/assets/images/rings/Connection1.svg"
            alt="Connection">
        </div>

        <div class="Title">Connection</div>
        <div class="Card">
          Proof generation, recursion, smart contracts, DA solutions & more;
          Zeko offers everything developers need to bring their zkApp ideas to
          life.
        </div>
      </div>
      <div class="Node Accessibility" ref="Accessibility">
        <img
          class="Hovered"
          src="~/assets/images/rings/Accessibility2.svg"
          alt="Accessibility">
        <img
          class="NotHovered"
          src="~/assets/images/rings/Accessibility1.svg"
          alt="Accessibility">
        <div class="Title">Accessibility</div>
        <div class="Card">
          Developers can write and deploy applications in any programming
          language to an isomorphic Zeko L2, or spin up to their own custom
          zkAppChains.
        </div>
      </div>
      <div class="Node Origin" ref="Origin">
        <img
          class="Hovered"
          src="~/assets/images/rings/Origin2.png"
          alt="Origin">
        <img
          class="NotHovered"
          src="~/assets/images/rings/Origin1.png"
          alt="Origin">
        <div class="Title">Origin</div>
        <div class="Card">
          Zeko chains enjoy easy composability between each other and Mina
          itself using recursive proofs and shared infrastructure.
        </div>
      </div>
      <div class="Node Scaling" ref="Scaling">
        <img
          class="Hovered"
          src="~/assets/images/rings/Scaling2.png"
          alt="Scaling">
        <img
          class="NotHovered"
          src="~/assets/images/rings/Scaling1.png"
          alt="Scaling">
        <div class="Title">Scaling</div>
        <div class="Card">
          Through trustless zk-bridging, proofs that verify on Zeko can be
          consumed by the EVM, dramatically upending existing paradigms for
          blockchain applications.
        </div>
      </div>
      <div class="Node Legion" ref="Legion">
        <img
          class="Hovered"
          src="~/assets/images/rings/Legion2.svg"
          alt="Legion">
        <img
          class="NotHovered"
          src="~/assets/images/rings/Legion1.svg"
          alt="Legion">
        <div class="Title">Legion</div>
        <div class="Card">
          Zeko is a community of builders obsessed with pioneering applications,
          optimizing performance, and enhancing the user experience. We shape
          the future and inspire the zkInternet.
        </div>
      </div>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.background {
  position: relative;
  height: 100%;
  overflow: hidden;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes bigpulse {
  0% {
    transform: scale(3);
  }
  50% {
    transform: scale(3.15);
  }
  100% {
    transform: scale(3);
  }
}

.background-image {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  object-fit: cover;
  z-index: 0;
  z-index: -1;
  animation: pulse 18s infinite;
}

@media (max-width: 1024px) {
  .background-image {
    transform: scale(3);
    animation: bigpulse 18s infinite;
  }
}

.Node {
  position: absolute;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 1.25rem;
  .Hovered {
    display: none;
  }
  .Title {
    font-size: var(--typography-lexend-xl);
    font-weight: 500;
  }
  img {
    width: 80px;
    transition: transform 0.3s;
    &:hover {
      transform: scale(1.1) rotate(180deg);
      transition: transform 0.3s;
    }
  }
}

.Connection {
  top: 15%;
  left: 45%;
}

.Accessibility {
  top: 30%;
  left: 22%;
}

.Origin {
  top: 65%;
  left: 24%;
}

.Scaling {
  top: 65%;
  left: 60%;
}

.Legion {
  top: 40%;
  left: 61%;
}

.Card {
  display: none;
  position: absolute;
  left: 6rem;
  top: 4rem;
  width: 45ch;
  background-color: oklch(1 0 0 / 0.72);
  backdrop-filter: blur(0.125rem);
  border-radius: 0.5rem;
  padding: 1rem;
  font-size: var(--typography-lexend-s);
  font-weight: 400;
  text-wrap: balance;
}

body:has(.Connection:hover) .Connection,
body:has(.Accessibility:hover) .Accessibility,
body:has(.Origin:hover) .Origin,
body:has(.Scaling:hover) .Scaling,
body:has(.Legion:hover) .Legion {
  .Card {
    display: grid;
  }
  .Hovered {
    display: block;
  }
  .NotHovered {
    display: none;
  }
}

.Nodes {
  position: relative;
  height: 100vh;
}

@media (max-width: 1024px) {
  .Nodes {
    height: auto;
    min-height: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 4rem 1rem;
  }
  .Node {
    position: relative;
    top: auto;
    left: auto;
    display: grid;
    gap: 1rem;
    grid-template-areas: "Picture Title" "Card Card";
    grid-template-columns: auto 1fr;
    img {
      width: 4ch;
      height: 4ch;
    }
  }
  .Node:nth-child(even) {
    grid-template-areas: "Title Picture" "Card Card";
    grid-template-columns: 1fr auto;
    text-align: right;
  }
  .Card {
    grid-area: Card;
    position: relative;
    display: grid;
    top: auto;
    left: auto;
    width: 100%;
    backdrop-filter: blur(0.25rem);
    text-wrap: wrap;
  }
  .Picture {
    grid-area: Picture;
  }
  .Title {
    grid-area: Title;
  }
}
</style>
