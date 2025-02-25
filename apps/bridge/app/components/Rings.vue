<template>
  <div class="background">
    <SvgZekoBigRings />
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
        Proof generation, recursion, smart contracts, DA solutions & more; Zeko
        offers everything developers need to bring their zkApp ideas to life.
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
        Developers can write and deploy applications in any programming language
        to an isomorphic Zeko L2, or spin up to their own custom zkAppChains.
      </div>
    </div>
    <div class="Node Origin" ref="Origin">
      <img
        class="Hovered"
        src="~/assets/images/rings/Origin2.svg"
        alt="Origin">
      <img
        class="NotHovered"
        src="~/assets/images/rings/Origin1.svg"
        alt="Origin">
      <div class="Title">Origin</div>
      <div class="Card">
        Zeko chains enjoy easy composability between each other and Mina itself
        using recursive proofs and shared infrastructure.
      </div>
    </div>
    <div class="Node Scaling" ref="Scaling">
      <img
        class="Hovered"
        src="~/assets/images/rings/Scaling2.svg"
        alt="Scaling">
      <img
        class="NotHovered"
        src="~/assets/images/rings/Scaling1.svg"
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
        optimizing performance, and enhancing the user experience. We shape the
        future and inspire the new internet.
      </div>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.background {
    position: relative;
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.1);
    }
    100% {
        transform: scale(1);
    }
}

svg {
  position: relative;
  width: 100%;
  height: 60rem;
  pointer-events: none;
  animation: pulse 8s infinite;
  z-index: -1;
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
        font-size: var(--fonts-lexend-typescale-scale-xl);
        font-weight: 500;
    }
    img {
        transition: transform 0.3s;
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
    backdrop-filter: blur(2px);
    border-radius: 0.5rem;
    padding: 1rem;
    font-size: var(--fonts-lexend-typescale-scale-s);
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

.Connection, .Accessibility, .Legion{
  img:hover {
          transform: scale(1.1) rotate(180deg);
          transition: transform 0.3s;
  }
}

.Scaling {
  img:hover {
          transform: scale(1.1);
          transition: transform 0.3s;
  }
}
</style>
