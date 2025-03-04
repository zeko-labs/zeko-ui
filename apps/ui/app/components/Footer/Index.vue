<script lang="ts" setup>
const toggle = ref(false)
const state = computed(() => (toggle.value ? "Users" : "Builders"))
const description = computed(() =>
	state.value === "Builders"
		? "Create your first zkApp, Deploy to Zeko Testnet, Grow your user base and earn rewards."
		: "Create a wallet, Faucet on Testnet, Try new zkApps and earn rewards."
)
</script>
<template>
  <div class="background">
    <img
      src="/assets/images/footer.webp"
      alt="Footer background"
      class="background-image"
      loading="lazy"
    />
    <div class="Content">
      <div class="Main">
        <div class="Title">Join the Zeko Revolution</div>
        <div class="Toggler">
          <FooterSwitch v-model="toggle" />
        </div>
        <div class="Description">
          {{ description }}
        </div>
        <Switch>
          <Match :when='state === "Builders"'>
            <NuxtLink
              to="https://docs.zeko.io"
              target="_blank">
              <Button variant="cta1">Start Building</Button>
            </NuxtLink>
          </Match>
          <Match :when='state === "Users"'>
            <NuxtLink to="/faucet">
              <Button variant="cta1">Try Testnet</Button>
            </NuxtLink>
          </Match>
        </Switch>
      </div>
      <div class="Footer">
        <div class="Date">
          ©{{ new Date().getFullYear() }} Zeko Labs, All Rights Reserved
        </div>
        <div class="Logos">
          <AllLogos />
        </div>
        <div class="TOS">
          <a href="#" target="_blank">Terms of Service</a>
          <a href="#" target="_blank">Privacy Policy</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
h2, p {
    margin: 0;
}

.background {
    position: relative;
    height: 100%;
    overflow: hidden;
}

.background-image {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    object-fit: cover;
    object-position: 50%;
    z-index: 0;
}

.Content {
    position: relative;
    z-index: 1;
    display: flex;
    padding: 3.5rem 5.5rem;
    gap: 3.5rem;
    flex-direction: column;
    align-items: flex-start;
    align-self: stretch;
}

@media (max-width: 1024px) {
    .Content {
        padding: 4rem 1rem 2rem 1rem;
    }
}

.Main {
    display:flex;
    align-items: center;
    flex-direction: column;
    width: 100%;
    text-align: center;
    gap: 1rem;
    .Title {
        font-size: var(--fonts-lexend-typescale-scale-h4);
        font-weight: 500;
        line-height: 140%;
        width: 15ch;
    }
    .Description {
        padding: 1rem 0 0.5rem 0;
        font-size: var(--fonts-lexend-typescale-scale-m);
        font-weight: 500;
        width: 40ch;
        color: oklch(100 0 0 / 0.8);
        text-wrap: balance;
    }
}
.Footer {
    display: grid;
    grid-template-areas: "date logos tos";
    grid-template-columns: 1fr 1fr 1fr;
    width: 100%;
    justify-items: center;
    align-items: center;
    padding: 2rem 0rem;
    .Date {
        grid-area: date;
        font-size: var(--fonts-lexend-typescale-scale-xs);
        font-weight: 400;
        opacity: 0.5;
        justify-self: start;
    }
    .Logos {
        grid-area: logos;
        display: flex;
        gap: 1.5rem;
        :deep(a) {
            color: white;
            &:hover {
                transform: scale(1.2);
            }
        }
    }
    .TOS {
        grid-area: tos;
        display: flex;
        gap: 1.5rem;
        justify-self: end;
        font-size: var(--fonts-lexend-typescale-scale-xs);
        font-weight: 400;
        opacity: 0.8;
        a {
            color: white;
            text-decoration: none;
            &:hover {
                opacity: 1;
                transform: scale(1.02);
            }
        }
    }
}
@media (max-width: 1024px) {
    .Footer {
        grid-template-areas: "logos" "date" "tos";
        grid-template-columns: auto;
        grid-template-rows: auto auto auto;
        gap: 1rem;
        padding: 0;
        .Date {
            justify-self: center;
            font-size: var(--fonts-lexend-typescale-scale-s);
        }
        .Logos {
            justify-self: center;
        }
        .TOS {
            justify-self: center;
            font-size: var(--fonts-lexend-typescale-scale-s);
        }
    }
}
</style>
