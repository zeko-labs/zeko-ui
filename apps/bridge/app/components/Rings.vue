<script lang="ts" setup>
</script>
<template>
  <div class="background">
    <SvgZekoBigRings />
    <div class="Node Connection">
      <img
        src="~/assets/images/rings/connection.png"
        alt="Connection">
      <div class="Title">Connection</div>
      <div class="Card">
        <div class="CardTitle">Connection</div>
        <div class="CardText">
          Proof generation, recursion, smart contracts, DA solutions & more;
          Zeko offers everything developers need to bring their zkApp ideas to
          life.
        </div>
      </div>
    </div>
    <div class="Node Accessibility">
      <img
        src="~/assets/images/rings/accessibility.png"
        alt="Accessibility">
      <div class="Title">Accessibility</div>
      <div class="Card">
        <div class="CardTitle">Accessibility</div>
        <div class="CardText">
          Developers can write and deploy applications in any programming
          language to an isomorphic Zeko L2, or spin up to their own custom
          zkAppChains.
        </div>
      </div>
    </div>
    <div class="Node Origin">
      <img
        src="~/assets/images/rings/origin.png"
        alt="Origin">
      <div class="Title">Origin</div>
      <div class="Card">
        <div class="CardTitle">Origin</div>
        <div class="CardText">
          Zeko chains enjoy easy composability between each other and Mina
          itself using recursive proofs and shared infrastructure.
        </div>
      </div>
    </div>
    <div class="Node Scaling">
      <img
        src="~/assets/images/rings/scaling.png"
        alt="Scaling">
      <div class="Title">Scaling</div>
      <div class="Card">
        <div class="CardTitle">Scaling</div>
        <div class="CardText">
          Through trustless zk-bridging, proofs that verify on Zeko can be
          consumed by the EVM, dramatically upending existing paradigms for
          blockchain applications.
        </div>
      </div>
    </div>
    <div class="Node Legion">
      <img
        src="~/assets/images/rings/legion.png"
        alt="Legion">
      <div class="Title">Legion</div>
      <div class="Card">
        <div class="CardTitle">Legion</div>
        <div class="CardText">
          Zeko is a community of builders obsessed with pioneering applications,
          optimizing performance, and enhancing the user experience. We shape
          the future and inspire the new internet.
        </div>
      </div>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.background {
    position: relative;
}
svg {
  width: 100%;
  height: 60rem;
  pointer-events: none;
}

.Node {
    position: absolute;
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 1.25rem;
    .Title {
        font-size: var(--fonts-lexend-typescale-scale-xl);
        font-weight: 500;
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
    left: 100px; /* Size of the image */
    max-width: 50ch;
    min-width: 40ch;
    background-color: oklch(1 0 0 / 0.9);
    border-radius: 0.5rem;
    padding: 2rem;
    gap: 1rem;
    .CardTitle {
        font-size: var(--fonts-lexend-typescale-scale-xl);
        font-weight: 500;
    }
}

body:has(.Connection:hover) .Connection {
    .Title {
        display:none;
    }
    .Card {
        display: grid;
    }
    img {
        transform: scale(1.1);
        transition: transform 0.3s;
    }
}


body:has(.Accessibility:hover) .Accessibility {
    .Title {
        display:none;
    }
    .Card {
        display: grid;
    }
    img {
        transform: scale(1.1);
        transition: transform 0.3s;
    }
}

body:has(.Origin:hover) .Origin {
    .Title {
        display:none;
    }

    .Card {
        display: grid;
    }
    img {
        transform: scale(1.1);
        transition: transform 0.3s;
    }
}

body:has(.Scaling:hover) .Scaling  {
    .Title {
        display:none;
    }

    .Card {
        display: grid;
    }
    
    img {
        transform: scale(1.1);
        transition: transform 0.3s;
    }
}



body:has(.Legion:hover) .Legion {
    .Title {
        display:none;
    }

    .Card {
        display: grid;
    }
    img {
        transform: scale(1.1);
        transition: transform 0.3s;
    }
}
</style>
