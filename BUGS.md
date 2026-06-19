# Bridge Bugs

## Bug 1: Claimed deposits can block the main queue

Status: fixed in this branch.

Symptom: a deposit can remain the active queue head after it has been claimed and moved to completed transactions. The next main operation stays paused, so the bridge form becomes usable again even though queued work remains. Sim Refresh rebuilds recovered state and can make the next operation continue.

Debug-mode check: this is not a mock backend artifact. Debug mode uses the same `Bridge.vue` and `CurrentOperation.vue` rendering path as the real bridge UI, and the failure matches a Vue component reuse issue when the current operation actor changes.

Cause: `CurrentOperation` subscribes to the operation actor it receives during setup. `Bridge.vue` rendered the current operation without a key, so Vue could reuse the component instance when the active actor changed from the claimed deposit to the next queued operation. The parent state and completed list could move on while the child component stayed subscribed to the claimed actor.

Fix: key `CurrentOperation` by the actor id so changing the active operation remounts the component and creates a fresh actor subscription.
