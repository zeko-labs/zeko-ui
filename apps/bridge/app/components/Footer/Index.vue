<script lang="ts" setup>
const toggle = ref(false)
const state = computed(() => (toggle.value ? "Users" : "Builders"))
</script>
<template>
  <div class="background">
    <div class="Content">
      <div class="Main">
        <div class="Title">Join the Zeko Revolution</div>
        <div class="Toggler">
          <FooterSwitch v-model="toggle" />
        </div>
        <div class="Description">
          Create your first zkApp, Deploy to Zeko Testnet, Grow your user base
          while you earn rewards.
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
          <a href="https://x.com/ZekoLabs" target="_blank">
            <SvgSocialX />
          </a>
          <a href="https://t.me/zekoprotocol" target="_blank">
            <SvgSocialTelegram />
          </a>
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
    background-image: url("~/assets/images/footer.png");
    background-size: cover;
    height: 100%;
}

.Content {
    display: flex;
    padding: 3.5rem 5.5rem;
    gap: 3.5rem;
    flex-direction: column;
    align-items: flex-start;
    align-self: stretch;
}

.Main {
    display:flex;
    align-items: center;
    flex-direction: column;
    width: 100%;
    text-align: center;
    gap: 1rem;
    .Title {
        font-size: var(--fonts-lexend-typescale-scale-xxl);
        font-weight: 500;
        width: 15ch;
    }
    .Description {
        padding: 1rem 0 0.5rem 0;
        font-size: var(--fonts-lexend-typescale-scale-m);
        font-weight: 500;
        width: 40ch;
        text-wrap: balance;
    }
}
.Footer {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    width: 100%;
    justify-items: center;
    align-items: center;
    padding: 2rem 0rem;
    .Date {
        font-size: var(--fonts-lexend-typescale-scale-xs);
        font-weight: 400;
        opacity: 0.5;
        justify-self: start;
    }
    .Logos {
        display: flex;
        gap: 1.5rem;
        a {
            color: white;
            &:hover {
                transform: scale(1.2);
            }
        }
    }
    .TOS {
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
</style>
