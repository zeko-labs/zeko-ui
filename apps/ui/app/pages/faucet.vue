<script lang="ts" setup>
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Field } from "@ark-ui/vue/field"
import { useActor } from "@xstate/vue"
import { type } from "arktype"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { ArrowBigRight, TriangleAlert } from "lucide-vue-next"
import { assign, enqueueActions, fromPromise, setup } from "xstate"
import { faucetBody } from "~~/helpers/validation"
const minaAddress = defineModel()

const id = useId()

const faucetMachine = setup({
	types: {
		events: {} as { type: "SUBMIT" },
		context: {} as { errorMessage: string; hash: string }
	},
	actors: {
		submit: fromPromise(async () => {
			const response = await fetch("/api/faucet", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ address: minaAddress.value })
			})
			const result = await response.json()
			const data = faucetBody(result)
			if (data instanceof type.errors || !response.ok)
				throw new Error(`An error has occurred: ${data.message}`)
			return data
		})
	}
}).createMachine({
	id: "faucet",
	initial: "IDLE",
	context: {
		errorMessage: "Unknown error",
		hash: ""
	},
	states: {
		IDLE: { on: { SUBMIT: "PENDING" } },
		PENDING: {
			entry: enqueueActions(({ enqueue }) => {
				enqueue.assign({ errorMessage: "Unknown error", hash: "" })
			}),
			invoke: {
				src: "submit",
				onDone: {
					target: "SUCCESS",
					actions: assign({ hash: ({ event }) => event.output.hash ?? "" })
				},
				onError: {
					target: "ERROR",
					actions: assign({ errorMessage: ({ event }) => String(event.error) })
				}
			}
		},
		ERROR: { on: { SUBMIT: "PENDING" } },
		SUCCESS: { on: { SUBMIT: "PENDING" } }
	}
})
const faucet = useActor(faucetMachine)
const success = computed(() => faucet.snapshot.value.matches("SUCCESS"))
const error = computed(() => faucet.snapshot.value.matches("ERROR"))
const pending = computed(() => faucet.snapshot.value.matches("PENDING"))
const errorMessage = computed(() => faucet.snapshot.value.context.errorMessage)
const zekoScanLink = computed(
	() =>
		`https://zekoscan.io/testnet/tx/${faucet.snapshot.value.context.hash}/txInfo?type=zk-tx`
)

const submitDisabled = computed(
	() =>
		pending.value ||
		!minaAddress.value ||
		(typeof minaAddress.value === "string" && minaAddress.value.length === 0)
)
</script>
<template>
  <main>
    <div class="NavigationSectionWrapper">
      <header>
        <Navigation />
      </header>
      <div class="SectionWrapper">
        <section class="GetWallet">
          <div class="TitleWrapper">
            <SvgNumbersOne />
            <h3>Get Wallet</h3>
          </div>
          <ul>
            <li>
              <div class="Download">
                <span>Download Auro Wallet</span>
                <NuxtLink to="https://www.aurowallet.com/" target="_blank">
                  <Button variant="auro">Download Wallet</Button>
                </NuxtLink>
              </div>
            </li>

            <li>Switch Network to Zeko Testnet</li>
            <li>Use Faucet to get testnet tokens</li>
          </ul>
        </section>
        <section class="Faucet">
          <div class="TitleWrapper">
            <SvgNumbersTwo />
            <h3>Faucet</h3>
          </div>

          <div class="Form">
            <p>
              Enter your Zeko address to receive testnet MINA (tMINA) on Zeko L2
            </p>
            <Field.Root :id>
              <Field.Label>MINA Address</Field.Label>

              <div class="InputButtonWrapper">
                <div class="InputWrapper">
                  <SvgMinaToken width="24" height="24" />
                  <Field.Input
                    v-model="minaAddress"
                    type="text"
                    placeholder="Enter Zeko/MINA address"
                  />
                </div>
                <div class="Submit">
                  <Button
                    variant="black"
                    :disabled="submitDisabled"
                    @click='faucet.send({ type: "SUBMIT" })'>
                    {{ pending ? "Requesting..." : "Request tMINA" }}
                    <ArrowBigRight />
                  </Button>
                </div>
              </div>

              <!-- <Field.HelperText>  Limit of 1 use per address on each network to help ensure everyone has access.</Field.HelperText> -->
              <!-- <Field.ErrorText> {{ errorMessage }}</Field.ErrorText> -->
            </Field.Root>
            <div class="Result">
              <p class="success" v-if="success">
                tMINA succesfully requested to <span>{{ minaAddress }}</span>
                <a
                  :href="zekoScanLink"
                  target="_blank"
                  rel="noopener noreferrer">
                  View on ZekoScan
                </a>
              </p>
              <div class="error" v-if="error">
                <TriangleAlert />
                <span>
                  {{ errorMessage }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
    <footer>
      Disclaimer: Limit of 1 use per address on each network. Tokens have no
      value, monetary or otherwise, and are solely useful for experimenting on
      testnets. tMINA cannot be sold and is not redeemable for any
      cryptocurrency or digital asset.
    </footer>
  </main>
</template>
<style lang="postcss" scoped>
main {
  position: relative;
  width: 100vw;
  padding: 0 4rem;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: min-content auto;
  color: var(--colors-gray-900);
  font-size: var(--fonts-lexend-typescale-scale-m);
  :deep(.Navigation) {
    padding: 2.5rem 0rem;
  }
  /* Mobile */
  @media (max-width: 480px) {
    padding: 0 1rem;
  }
  /* Tablet & Desktop */
  @media (min-width: 480px) {
    min-height: 100svh;
  }

  .NavigationSectionWrapper {
    /* Mobile */
    @media (max-width: 480px) {
      min-height: 100svh;
    }
  }
}
h3 {
  font-size: var(--fonts-lexend-typescale-scale-h3);
  color: var(--colors-gray-950);
  padding: 0;
  margin: 0;
}
a {
  color: var(--colors-cosmicGold-200);
  text-decoration: none;
}

.SectionWrapper {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  padding: 4.5rem 0 0 0;

  /* Mobile */
  @media (max-width: 480px) {
    padding: 0;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    gap: 4rem;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 0rem;
    text-wrap: balance;
    /* Mobile */
    @media (max-width: 480px) {
      gap: 2.5rem;
    }
    .TitleWrapper {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      /* Mobile */
      @media (max-width: 480px) {
        flex-direction: row;
        align-items: center;
        gap: 1rem;
      }
    }
  }

  .GetWallet {
    ul {
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
      /* Mobile */
      @media (max-width: 480px) {
        padding-inline-start: 1.75rem;
      }
    }
    li {
      padding-left: 1rem;
      /* Mobile */
      @media (max-width: 480px) {
        padding-left: 0.5rem;
      }
    }
  }
  .Download {
    display: grid;
    gap: 1rem;
    button, a {
      width: fit-content;
    }
  }
}

.Faucet {
  p {
    color: var(--colors-gray-800);
    &.success {
      color: var(--colors-complete-content);
    }
  }
  .error {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    color: var(--colors-persianRed-500);
  }
}

.Form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  p {
    margin: 0;
  }
  span, input {
    font-family: Lexend;
    font-weight: 400;
  }

  /* Wrapper */
  [data-scope="field"][data-part="root"] {
    display: grid;
    gap: 0.5rem;
  }

  .InputButtonWrapper {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    /* Mobile */
    @media (max-width: 480px) {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
    }
  }

  .InputWrapper {
    display: inline-flex;
    align-items: center;
    color: var(--colors-gray-900);
    background-color: white;
    opacity: 0.75;
    border-radius: 0.5rem;
    border: 1px solid var(--colors-gray-200);
    padding-left: 1rem;
    width: 100%;
    input {
      width: 100%;
    }
    &:has(input:focus) {
      background: var(--gradients-border-mainnetEra-background);
      border: var(--gradients-border-mainnetEra-border);
    }
  }

  /* Input field */
  [data-scope="field"][data-part="input"] {
    background: transparent;
    border: none;
    font-size: var(--fonts-lexend-typescale-scale-s);
    padding: 12px 16px;
    outline: none;
    height: 100%;
    /* width: calc(58ch + 2rem); */
    border-radius: 0.5rem;
  }
  @media (max-width: 1024px) {
    [data-scope="field"][data-part="input"] {
      width: 100%;
    }
  }

  /* Label */
  [data-scope="field"][data-part="label"] {
    font-size: var(--fonts-lexend-typescale-scale-xs);
    color: var(--semantic-content-tertiary);
  }

  [data-scope="field"][data-part="helper-text"] {
    font-size: var(--fonts-lexend-typescale-scale-xs);
    font-style: italic;
  }

  .Submit {
    button {
      /* Mobile */
      @media (max-width: 480px) {
        width: 100%;
      }
    }
  }
}

footer {
  font-size: var(--fonts-lexend-typescale-scale-s);
  color: var(--colors-gray-500);
  padding: 4rem 0 4rem 0;
  /* Tablet & Desktop */
  @media (min-width: 480px) {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
  }
}
</style>
