import { Field, Poseidon, type Types } from "o1js"

export function empty(): Types.Events {
	return {
		hash: Field.from(
			"2965377540200775924504968637505084669999360240500907972788072774778139588064"
		),
		data: []
	}
}

export function hash(action: Field[]): Field {
	return Poseidon.hashWithPrefix("MinaZkappEvent******", action)
}

export function pushHash(actionState: Field, hash: Field): Field {
	return Poseidon.hashWithPrefix("MinaZkappSeqEvents**", [actionState, hash])
}

export function pushAction(actions: Types.Events, action: Field[]): Types.Events {
	return {
		hash: pushHash(actions.hash, hash(action)),
		data: [action, ...actions.data]
	}
}

export function fromList(events: Field[][]): Types.Events {
	return [...events].reverse().reduce(pushAction, empty())
}
