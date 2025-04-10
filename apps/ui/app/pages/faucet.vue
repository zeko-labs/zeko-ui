<script lang="ts" setup>
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Field } from "@ark-ui/vue/field"
import { useActor } from "@lumina-dex/sdk/vue"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { ArrowBigRight } from "lucide-vue-next"
import { assign, fromPromise, setup } from "xstate"
const minaAddress = defineModel()

const id = useId()
const faucetMachine = setup({
	types: {
		events: {} as { type: "SUBMIT" }
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
			const result = await response.text()
			if (!response.ok) throw new Error(result)
			return result
		})
	}
}).createMachine({
	id: "faucet",
	initial: "IDLE",
	context: {
		errorMessage: ""
	},
	states: {
		IDLE: { on: { SUBMIT: "PENDING" } },
		PENDING: {
			invoke: {
				src: "submit",
				onDone: {
					target: "SUCCESS"
				},
				onError: {
					target: "ERROR",
					actions: assign({ errorMessage: ({ event }) => event.error })
				}
			}
		},
		ERROR: {
			on: {
				SUBMIT: { target: "PENDING", actions: assign({ errorMessage: "" }) }
			}
		},
		SUCCESS: {
			on: {
				SUBMIT: { target: "PENDING" }
			}
		}
	}
})
const faucet = useActor(faucetMachine)
const success = computed(() => faucet.snapshot.value.matches("SUCCESS"))
const error = computed(() => faucet.snapshot.value.matches("ERROR"))
const pending = computed(() => faucet.snapshot.value.matches("PENDING"))
const errorMessage = computed(() => faucet.snapshot.value.context.errorMessage)
const submitDisabled = computed(
	() =>
		pending.value ||
		!minaAddress.value ||
		(typeof minaAddress.value === "string" && minaAddress.value.length === 0)
)
</script>
<template>
  <main>
    <header>
      <Navigation />
    </header>
    <section class="Faucet">
      <h2>Faucet</h2>
      <p>
        Enter a Mina address to receive testnet MINA (tMINA) on Zeko L2. These
        have no value, monetary or otherwise, and are solely useful for
        experimenting on testnets. tMINA cannot be sold and is not redeemable
        for any cryptocurrency or digital asset. For help with installing and
        setting up a wallet, visit: <a
          href="https://docs.zeko.io/for_end_users">https://docs.zeko.io/for_end_users</a>
      </p>
      <span>
        To faucet tMINA on Mina L1 please visit <a
          href="https://faucet.minaprotocol.com">https://faucet.minaprotocol.com</a>
      </span>
      <div class="Form">
        <Field.Root :id>
          <Field.Label>MINA Address</Field.Label>
          <div class="InputWrapper">
            <SvgMinaToken width="24" height="24" />
            <Field.Input
              v-model="minaAddress"
              type="text"
              placeholder="Enter MINA address"
            />
          </div>
          <Field.HelperText>Limit of 1 use per address on each network to help
            ensure everyone has access.</Field.HelperText>
          <Field.ErrorText>{{ errorMessage }}</Field.ErrorText>
        </Field.Root>
        <div class="Submit">
          <Button
            variant="cta1"
            :disabled="submitDisabled"
            @click='faucet.send({ type: "SUBMIT" })'>
            {{ pending ? "Requesting..." : "Request tMINA" }} <ArrowBigRight />
          </Button>
        </div>
      </div>

      <div class="Result">
        <p v-if="success">
          tMINA succesfully requested to <span>{{ minaAddress }}</span>
        </p>
        <p class="error" v-if="error">{{ errorMessage }}</p>
      </div>
    </section>
  </main>
</template>
<style lang="postcss" scoped>
main {
  position: relative;
  min-height: 100svh;
  width: 100vw;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: min-content auto;
  gap: 1rem;
  color: var(--colors-gray-950);
  font-size: var(--fonts-lexend-typescale-scale-m);
}
h2 {
  font-size: var(--fonts-lexend-typescale-scale-h2);
  padding: 0;
  margin: 0;
}
a {
  color: var(--colors-cosmicGold-200);
  text-decoration: none;
}
section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem 4rem;
  max-width: 100ch;
  text-wrap: balance;
}

@media (max-width: 1024px) {
  section {
    max-width: 100vw;
  }
}

.Form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  span, input {
    font-family: Lexend;
    font-weight: 400;
  }

  /* Wrapper */
  [data-scope="field"][data-part="root"] {
    display: grid;
    gap: 0.5rem;
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
    width: fit-content;
  }

  /* Input field */
  [data-scope="field"][data-part="input"] {
    background: transparent;
    border: none;
    font-size: 1.125rem;
    padding: 12px 16px;
    outline: none;
    height: 100%;
    width: calc(58ch + 2rem);
    border-radius: 0.5rem;
  }
  @media (max-width: 1024px) {
    [data-scope="field"][data-part="input"] {
      width: 100%;
    }
  }

  /* Label */
  [data-scope="field"][data-part="helper-text"] {
    font-size: var(--fonts-lexend-typescale-scale-xs);
    font-style: italic;
  }
}

.error {
  color: var(--colors-persianRed-500);
}
</style>
