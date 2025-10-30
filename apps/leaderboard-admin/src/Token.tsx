import { type JSX, Show } from "solid-js"

type Props = {
	token: () => string
	input: () => string
	setInput: (v: string) => void
	save: () => void
	del: () => void
}

export default function Token({ token, input, setInput, save, del }: Props): JSX.Element {
	return (
		<section>
			<h2>API Token</h2>
			<Show
				when={token()}
				fallback={
					<div class="token-input">
						<label for="api-token">Enter API token</label>
						<input
							id="api-token"
							value={input()}
							type="password"
							onInput={(e) => setInput(e.currentTarget.value)}
							placeholder="Paste API token"
						/>
						<button type="button" onClick={save} disabled={!input().trim()}>
							Save token
						</button>
					</div>
				}
			>
				<div class="token-view">
					<p>
						Token: <code>{token().replaceAll(/./g, "•")}</code>
					</p>
					<button type="button" onClick={del} class="secondary">
						Delete token
					</button>
				</div>
			</Show>
		</section>
	)
}
