//TODO: Move this to the SDK or xstate https://github.com/statelyai/xstate/pull/5382
import {
	effectScope,
	getCurrentScope,
	isRef,
	onScopeDispose,
	type Ref,
	shallowRef,
	watch
} from "vue"
import type {
	Actor,
	ActorOptions,
	AnyActorLogic,
	AnyActorRef,
	AnyStateMachine,
	ConditionalRequired,
	EventFromLogic,
	IsNotNever,
	Observer,
	RequiredActorOptionsKeys,
	Snapshot,
	SnapshotFrom,
	Subscription
} from "xstate"

import { createActor, toObserver } from "xstate"

export function useActorRef<TLogic extends AnyActorLogic>(
	actorLogic: TLogic,
	...[options, observerOrListener]: IsNotNever<RequiredActorOptionsKeys<TLogic>> extends true
		? [
				options: ActorOptions<TLogic> & {
					[K in RequiredActorOptionsKeys<TLogic>]: unknown
				},
				observerOrListener?:
					| Observer<SnapshotFrom<TLogic>>
					| ((value: SnapshotFrom<TLogic>) => void)
			]
		: [
				options?: ActorOptions<TLogic>,
				observerOrListener?:
					| Observer<SnapshotFrom<TLogic>>
					| ((value: SnapshotFrom<TLogic>) => void)
			]
): Actor<TLogic> {
	const actorRef = createActor(actorLogic, options)

	let sub: Subscription | undefined
	if (observerOrListener) {
		sub = actorRef.subscribe(toObserver(observerOrListener))
	}
	actorRef.start()

	if (getCurrentScope()) {
		onScopeDispose(() => {
			actorRef.stop()
			sub?.unsubscribe()
		})
	}

	return actorRef
}

function defaultCompare<T>(a: T, b: T) {
	return a === b
}

const noop = () => {
	/* ... */
}

export function useSelector<
	TActor extends Pick<AnyActorRef, "getSnapshot" | "subscribe"> | undefined,
	T
>(
	actor: TActor | Ref<TActor>,
	selector: (
		snapshot: TActor extends { getSnapshot(): infer TSnapshot } ? TSnapshot : undefined
	) => T,
	compare: (a: T, b: T) => boolean = defaultCompare
): Ref<T> {
	const actorRefRef: Ref<TActor> = isRef(actor) ? actor : shallowRef(actor)
	const selected = shallowRef(selector(actorRefRef.value?.getSnapshot()))

	const updateSelectedIfChanged = (nextSelected: T) => {
		if (!compare(selected.value, nextSelected)) {
			selected.value = nextSelected
		}
	}

	const stopWatchingActorRef = watch(
		actorRefRef,
		(actorRef, _, onCleanup) => {
			updateSelectedIfChanged(selector(actorRef?.getSnapshot()))

			if (!actorRef) return
			const sub = actorRef.subscribe({
				next: (emitted) => {
					updateSelectedIfChanged(selector(emitted))
				},
				error: noop,
				complete: noop
			})

			onCleanup(() => {
				sub.unsubscribe()
			})
		},
		{
			immediate: true
		}
	)

	if (getCurrentScope()) {
		onScopeDispose(() => {
			stopWatchingActorRef()
		})
	}

	return selected
}

/** @alias useActor */
export function useMachine<TMachine extends AnyStateMachine>(
	machine: TMachine,
	...[options]: ConditionalRequired<
		[
			options?: ActorOptions<TMachine> & {
				[K in RequiredActorOptionsKeys<TMachine>]: unknown
			}
		],
		IsNotNever<RequiredActorOptionsKeys<TMachine>>
	>
): {
	snapshot: Ref<SnapshotFrom<TMachine>>
	send: (event: EventFromLogic<TMachine>) => void
	actorRef: Actor<TMachine>
} {
	return useActor(machine, options)
}

export function useActor<TLogic extends AnyActorLogic>(
	actorLogic: TLogic,
	...[options]: ConditionalRequired<
		[
			options?: ActorOptions<TLogic> & {
				[K in RequiredActorOptionsKeys<TLogic>]: unknown
			}
		],
		IsNotNever<RequiredActorOptionsKeys<TLogic>>
	>
): {
	snapshot: Ref<SnapshotFrom<TLogic>>
	send: Actor<TLogic>["send"]
	actorRef: Actor<TLogic>
}
export function useActor(actorLogic: AnyActorLogic, options: ActorOptions<AnyActorLogic> = {}) {
	if ("send" in actorLogic && typeof actorLogic.send === "function") {
		throw new Error(
			`useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
		)
	}

	const scope = effectScope()

	const result = scope.run(() => {
		const snapshot = shallowRef()

		function listener(nextSnapshot: Snapshot<unknown>) {
			snapshot.value = nextSnapshot
		}

		const actorRef = useActorRef(actorLogic, options, listener)
		snapshot.value = actorRef.getSnapshot()
		return { snapshot, actorRef, send: actorRef.send }
	})
	// Ensure cleanup happens when parent scope is disposed
	if (getCurrentScope()) {
		onScopeDispose(() => {
			scope.stop()
		})
	}

	if (!result) throw new Error("useActor: effectScope did not run correctly")
	return result
}
