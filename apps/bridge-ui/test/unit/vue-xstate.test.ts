import { effectScope, nextTick, shallowRef } from "vue"
import { describe, expect, it } from "vitest"
import { createActor, setup, type AnyActorRef } from "xstate"
import { useSelector } from "../../machines/vue-xstate"

const childMachine = setup({
	types: {
		events: {} as { type: "Start" }
	}
}).createMachine({
	initial: "idle",
	states: {
		idle: {
			on: { Start: "active" }
		},
		active: {}
	}
})

describe("useSelector", () => {
	it("reactively subscribes when an actor ref changes", async () => {
		const scope = effectScope()
		const childActor = shallowRef<AnyActorRef | undefined>()

		const selected = scope.run(() => useSelector(childActor, (snapshot) => snapshot?.value))

		expect(selected?.value).toBeUndefined()

		const actor = createActor(childMachine)
		actor.start()
		childActor.value = actor
		await nextTick()

		expect(selected?.value).toBe("idle")

		actor.send({ type: "Start" })
		await nextTick()

		expect(selected?.value).toBe("active")

		scope.stop()
		actor.stop()
	})

	it("unsubscribes from the previous actor when the actor ref is replaced", async () => {
		const scope = effectScope()
		const childActor = shallowRef<AnyActorRef | undefined>()

		const selected = scope.run(() => useSelector(childActor, (snapshot) => snapshot?.value))
		const firstActor = createActor(childMachine)
		const secondActor = createActor(childMachine)
		firstActor.start()
		secondActor.start()

		childActor.value = firstActor
		await nextTick()
		expect(selected?.value).toBe("idle")

		childActor.value = secondActor
		await nextTick()
		expect(selected?.value).toBe("idle")

		firstActor.send({ type: "Start" })
		await nextTick()
		expect(selected?.value).toBe("idle")

		secondActor.send({ type: "Start" })
		await nextTick()
		expect(selected?.value).toBe("active")

		scope.stop()
		firstActor.stop()
		secondActor.stop()
	})
})
