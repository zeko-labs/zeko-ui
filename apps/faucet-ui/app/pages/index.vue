<script lang="ts" setup>
import { Field } from "@ark-ui/vue/field"
import { useActor } from "@xstate/vue"
import { ArrowBigRight, TriangleAlert } from "lucide-vue-next"
import { assign, enqueueActions, fromPromise, setup } from "xstate"
import {
	type FaucetSuccessResponse,
	parseFaucetResponse
} from "~~/helpers/validation"

const minaAddress = defineModel()

const id = useId()

const { turnstileSiteKey } = useRuntimeConfig().public
const turnstile = useTurnstile(turnstileSiteKey)

type FaucetMachineContext = {
	errorMessage: string
	result: FaucetSuccessResponse | null
}

const faucetMachine = setup({
	types: {
		events: {} as { type: "SUBMIT" },
		context: {} as FaucetMachineContext
	},
	actors: {
		submit: fromPromise<FaucetSuccessResponse>(async () => {
			let cfToken: string
			try {
				cfToken = await turnstile.execute()
			} catch (error) {
				console.error("Turnstile execution failed:", error)
				throw new Error("Failed to verify you are human. Please try again.")
			}

			const response = await fetch("/api/faucet", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ address: minaAddress.value, cfToken })
			})

			const result = await response.json().catch(() => null)
			const data = parseFaucetResponse(result)
			if (!data) throw new Error("The faucet returned an unexpected response.")
			if (!data.success) throw new Error(data.message)

			return data
		})
	}
}).createMachine({
	id: "faucet",
	initial: "IDLE",
	context: {
		errorMessage: "Unknown error",
		result: null
	},
	states: {
		IDLE: { on: { SUBMIT: "PENDING" } },
		PENDING: {
			entry: enqueueActions(({ enqueue }) => {
				enqueue.assign({ errorMessage: "Unknown error", result: null })
			}),
			invoke: {
				src: "submit",
				onDone: {
					target: "SUCCESS",
					actions: assign({ result: ({ event }) => event.output })
				},
				onError: {
					target: "ERROR",
					actions: assign({
						errorMessage: ({ event }) =>
							event.error instanceof Error
								? event.error.message
								: String(event.error)
					})
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
const successResult = computed(() => faucet.snapshot.value.context.result)
const zekoScanLink = computed(() => successResult.value?.explorer_url ?? "")

const isValidAddress = computed(() => {
	if (!minaAddress.value || typeof minaAddress.value !== "string") return false
	return minaAddress.value.length === 55
})

const submitDisabled = computed(
	() => pending.value || turnstile.isExecuting.value || !isValidAddress.value
)
</script>
<template>
  <main>
    <div class="NavigationSectionWrapper">
      <div class="SectionWrapper">
        <section class="GetWallet">
          <div class="TitleWrapper">
            <SvgNumbersOne />
            <h3>Get Wallet</h3>
          </div>
          <ul>
            <li>
              <div class="Download">
                <NuxtLink to="https://www.aurowallet.com/" target="_blank">
                  <Button variant="auro">Download Wallet</Button>
                </NuxtLink>
              </div>
            </li>

            <li>Switch Network to the legacy Zeko-M Testnet</li>
            <li>Use Faucet to get testnet tokens</li>
          </ul>
        </section>
        <section class="Faucet">
          <div class="TitleWrapper">
            <SvgNumbersTwo />
            <h3>Legacy Testnet Faucet</h3>
          </div>

          <div class="Form">
            <p>
              Enter your Zeko-M address to receive legacy testnet MINA (tMINA).
              For ETH on the Ethereum-backed Zeko testnet, see the
              <a
                href="https://docs.zeko.io/users/getting-started">current
                getting-started guide</a>.
            </p>
            <Field.Root :id>
              <Field.Label>Zeko-M Address</Field.Label>

              <div class="InputButtonWrapper">
                <div class="InputWrapper">
                  <SvgZekoToken width="24" height="24" />
                  <Field.Input
                    v-model="minaAddress"
                    type="text"
                    placeholder="Enter Zeko-M address (B62...)"
                  />
                </div>
                <div class="Submit">
                  <Button
                    variant="black"
                    :disabled="submitDisabled"
                    @click='faucet.send({ type: "SUBMIT" })'>
                    {{
                      pending
                      ? turnstile.isExecuting
                      	? "Verifying..."
                      	: "Requesting..."
                      : "Request tMINA"
                    }}
                    <ArrowBigRight />
                  </Button>
                </div>
              </div>

              <!-- <Field.HelperText>  Limit of 1 use per address on each network to help ensure everyone has access.</Field.HelperText> -->
              <!-- <Field.ErrorText> {{ errorMessage }}</Field.ErrorText> -->
            </Field.Root>
            <div class="Result">
              <p class="success" v-if="success && successResult">
                tMINA successfully requested to <span>{{
                  successResult.address
                }}</span>
                <a
                  :href="zekoScanLink"
                  target="_blank"
                  rel="noopener noreferrer">
                  View on ZekoScan
                </a>
              </p>
              <div class="error" v-if="error">
                <TriangleAlert />
                <span> {{ errorMessage }} </span>
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
  color: var(--palette-gray-900);
  font-size: var(--typography_fluid-lexend-m);

  @media (--phone) {
    padding: 0 1rem;
  }

  @media (--tablet) {
    min-height: calc(100svh - 5rem);
  }
}
h3 {
  font-size: var(--typography_fluid-lexend-h3);
  color: var(--palette-gray-950);
  padding: 0;
  margin: 0;
}
a {
  color: var(--palette-cosmicGold-200);
  text-decoration: none;
}

.SectionWrapper {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  padding: 4.5rem 0 0 0;
  max-width: 1200px;
  margin: 0 auto;

  @media (--phone) {
    padding: 0;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    gap: 4rem;
  }

  @media (--large-desktop) {
    max-width: 1400px;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 0rem;
    text-wrap: balance;

    @media (--phone) {
      gap: 2.5rem;
    }
    .TitleWrapper {
      display: flex;
      flex-direction: column;
      gap: 2rem;

      @media (--phone) {
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

      @media (--phone) {
        padding-inline-start: 1.75rem;
      }
    }
    li {
      padding-left: 1rem;

      @media (--phone) {
        padding-left: 0.5rem;
      }
    }
  }
  .Download {
    display: grid;
    gap: 1rem;
    button,
    a {
      width: fit-content;
    }
  }
}

.Faucet {
  p {
    color: var(--palette-gray-800);
    &.success {
      color: var(--palette-complete-content);
    }
  }
  .error {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    color: var(--palette-persianRed-500);
  }
}

.Form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  p {
    margin: 0;
  }
  span,
  input {
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

    @media not (--desktop) {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
    }
  }

  .InputWrapper {
    display: inline-flex;
    align-items: center;
    color: var(--palette-gray-900);
    opacity: 0.75;
    border-radius: 0.5rem;
    padding-left: 1rem;
    width: 100%;
    height: var(--button-cta-height);
    --bg: white;
    background:
      linear-gradient(var(--bg), var(--bg)) padding-box,
      var(--gradients-goldGradient-button-main-2) border-box;
    border: 1px solid transparent;
    input {
      width: 100%;
    }
    &:has(input:focus) {
      background: var(--border-mainnetEra-background);
      border: var(--border-mainnetEra-border);
    }
  }

  /* Input field */
  [data-scope="field"][data-part="input"] {
    background: transparent;
    border: none;
    font-size: var(--typography_fluid-lexend-s);
    padding: 12px 16px;
    outline: none;
    height: 100%;
    /* width: calc(58ch + 2rem); */
    border-radius: 0.5rem;
  }
  @media (--desktop) {
    [data-scope="field"][data-part="input"] {
      width: 100%;
    }
  }

  /* Label */
  [data-scope="field"][data-part="label"] {
    font-size: var(--typography_fluid-lexend-xs);
    color: var(--theme-light-content-tertiary);
  }

  [data-scope="field"][data-part="helper-text"] {
    font-size: var(--typography_fluid-lexend-xs);
    font-style: italic;
  }

  .Submit {
    button {
      @media not (--desktop) {
        width: 100%;
      }
    }
  }
}

footer {
  font-size: var(--typography_fluid-lexend-s);
  color: var(--palette-gray-500);
  padding: 4rem 0 4rem 0;
  @media (--tablet) {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
  }
}
</style>
