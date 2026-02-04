import { defineComponent, Fragment, type VNode } from "vue"

const flattenChildren = (children: VNode[]): VNode[] =>
	children.flatMap((c) =>
		c.type === Fragment ? flattenChildren((c.children as VNode[]) ?? []) : [c]
	)

const isCase = (vnode: VNode): boolean =>
	typeof vnode.type === "object" && "name" in vnode.type && vnode.type.name === "Case"

const evaluateCondition = (vnode: VNode): boolean => {
	const when = vnode.props?.when
	return typeof when === "function" ? when() : Boolean(when)
}

/**
 * A Switch/Match component that correctly updates in production builds.
 *
 * Vue's template compiler marks slot content as "stable" (`_: 1`) when slots
 * don't contain `v-if`, `v-for`, or dynamic slot names. In production, Vue's
 * `shouldUpdateComponent` skips re-rendering components with stable slots when
 * only the parent's state has changed. This prevents the original `Switch`
 * component from `@hebilicious/vue-switch-match` from re-evaluating which
 * `Match` to display.
 *
 * This component works around the issue by accepting a `:signal` prop bound to
 * a reactive value (e.g. the XState machine snapshot). When the signal changes,
 * Vue detects the prop change and re-renders this component, allowing slot
 * children to be re-evaluated with fresh `when` conditions.
 *
 * @example
 * ```vue
 * <SwitchMatch :signal="machine">
 *   <Case :when='machine.matches("PENDING")'>Pending…</Case>
 *   <Case :when='machine.matches("DONE")'>Done!</Case>
 * </SwitchMatch>
 * ```
 */
export const SwitchMatchComponent = defineComponent({
	name: "SwitchMatch",
	inheritAttrs: false,
	props: {
		signal: { type: null, default: undefined }
	},
	setup(_props, { slots }) {
		return () => {
			const children = slots.default?.() ?? []
			const flat = flattenChildren(children)
			const matched = flat.filter(isCase).find(evaluateCondition)
			return matched ?? null
		}
	}
})

/**
 * A case component for use inside SwitchMatch.
 * Renders its default slot content when matched.
 */
export const CaseComponent = defineComponent({
	name: "Case",
	props: {
		when: { type: [Boolean, Function], required: true }
	},
	setup(_, { slots }) {
		return () => slots.default?.() ?? null
	}
})
