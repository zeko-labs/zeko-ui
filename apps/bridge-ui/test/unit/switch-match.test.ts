import { Match, Switch } from "@hebilicious/vue-switch-match"
import { afterEach, describe, expect, it } from "vitest"
import { createApp, defineComponent, h, nextTick, type Ref, ref } from "vue"
import {
	CaseComponent as Case,
	SwitchMatchComponent as SwitchMatch
} from "../../app/components/switch-match-logic"

/**
 * Helper that simulates the production compiled output by setting the stable slot flag (_: 1).
 * In production, Vue's template compiler marks slots as STABLE when they don't use
 * v-if, v-for, or dynamic slot names. This causes `shouldUpdateComponent` to return false,
 * preventing the child component from re-rendering when parent state changes.
 */
const mountWithStableSlot = (
	SwitchComponent: any,
	MatchComponent: any,
	extraProps?: (state: string) => Record<string, unknown>
) => {
	const container = document.createElement("div")
	document.body.appendChild(container)

	const stateRef: Ref<string> = ref("A")
	const app = createApp(
		defineComponent({
			setup() {
				return { state: stateRef }
			},
			render() {
				const state = this.state
				const slotFn = () => [
					h(MatchComponent, { when: state === "A" }, { default: () => "Message A", _: 1 }),
					h(MatchComponent, { when: state === "B" }, { default: () => "Message B", _: 1 }),
					h(MatchComponent, { when: state === "C" }, { default: () => "Message C", _: 1 })
				]
				return h(SwitchComponent, extraProps?.(state) ?? null, { default: slotFn, _: 1 })
			}
		})
	)
	app.mount(container)
	return { container, stateRef, app }
}

describe("Switch/Match production bug", () => {
	const containers: HTMLElement[] = []
	const apps: ReturnType<typeof createApp>[] = []

	afterEach(() => {
		for (const app of apps) app.unmount()
		for (const el of containers) el.remove()
		containers.length = 0
		apps.length = 0
	})

	const track = ({
		container,
		app
	}: { container: HTMLElement; app: ReturnType<typeof createApp> }) => {
		containers.push(container)
		apps.push(app)
	}

	it("library Switch/Match renders the initial matching message", async () => {
		const result = mountWithStableSlot(Switch, Match)
		track(result)
		await nextTick()
		expect(result.container.textContent).toBe("Message A")
	})

	it("library Switch/Match does NOT update when state changes (stable slot bug)", async () => {
		const result = mountWithStableSlot(Switch, Match)
		track(result)
		await nextTick()
		expect(result.container.textContent).toBe("Message A")

		result.stateRef.value = "B"
		await nextTick()
		// BUG: Vue skips re-rendering Switch because the slot is stable (_: 1).
		// The message stays as "Message A" instead of switching to "Message B".
		expect(result.container.textContent).toBe("Message A")
	})
})

describe("SwitchMatch fix", () => {
	const containers: HTMLElement[] = []
	const apps: ReturnType<typeof createApp>[] = []

	afterEach(() => {
		for (const app of apps) app.unmount()
		for (const el of containers) el.remove()
		containers.length = 0
		apps.length = 0
	})

	const track = ({
		container,
		app
	}: { container: HTMLElement; app: ReturnType<typeof createApp> }) => {
		containers.push(container)
		apps.push(app)
	}

	it("renders the initial matching Case", async () => {
		const result = mountWithStableSlot(SwitchMatch, Case, (state) => ({ signal: state }))
		track(result)
		await nextTick()
		expect(result.container.textContent).toBe("Message A")
	})

	it("updates when state changes thanks to :signal prop", async () => {
		const result = mountWithStableSlot(SwitchMatch, Case, (state) => ({ signal: state }))
		track(result)
		await nextTick()
		expect(result.container.textContent).toBe("Message A")

		result.stateRef.value = "B"
		await nextTick()
		expect(result.container.textContent).toBe("Message B")
	})

	it("renders nothing when no Case matches", async () => {
		const result = mountWithStableSlot(SwitchMatch, Case, (state) => ({ signal: state }))
		track(result)

		result.stateRef.value = "Z"
		await nextTick()
		expect(result.container.textContent).toBe("")
	})

	it("switches through multiple states", async () => {
		const result = mountWithStableSlot(SwitchMatch, Case, (state) => ({ signal: state }))
		track(result)
		await nextTick()
		expect(result.container.textContent).toBe("Message A")

		result.stateRef.value = "B"
		await nextTick()
		expect(result.container.textContent).toBe("Message B")

		result.stateRef.value = "C"
		await nextTick()
		expect(result.container.textContent).toBe("Message C")

		result.stateRef.value = "A"
		await nextTick()
		expect(result.container.textContent).toBe("Message A")
	})

	it("renders the first matching Case when multiple match", async () => {
		const container = document.createElement("div")
		document.body.appendChild(container)
		containers.push(container)

		const app = createApp(
			defineComponent({
				render() {
					const slotFn = () => [
						h(Case, { when: true }, { default: () => "First", _: 1 }),
						h(Case, { when: true }, { default: () => "Second", _: 1 })
					]
					return h(SwitchMatch, { signal: true }, { default: slotFn, _: 1 })
				}
			})
		)
		apps.push(app)
		app.mount(container)
		await nextTick()
		expect(container.textContent).toBe("First")
	})
})
