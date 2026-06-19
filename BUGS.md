# Bridge Bugs

## Bug 1: Claimed deposits can block the main queue

Status: fixed in this branch.

Symptom: a deposit can remain the active queue head after it has been claimed and moved to completed transactions. The next main operation stays paused, so the bridge form becomes usable again even though queued work remains. Sim Refresh rebuilds recovered state and can make the next operation continue.

Debug-mode check: this is not a mock backend artifact. Debug mode uses the same `Bridge.vue` and `CurrentOperation.vue` rendering path as the real bridge UI, and the failure matches a Vue component reuse issue when the current operation actor changes.

Cause: `CurrentOperation` subscribes to the operation actor it receives during setup. `Bridge.vue` rendered the current operation without a key, so Vue could reuse the component instance when the active actor changed from the claimed deposit to the next queued operation. The parent state and completed list could move on while the child component stayed subscribed to the claimed actor.

Fix: key `CurrentOperation` by the actor id so changing the active operation remounts the component and creates a fresh actor subscription.

## Bug 2: Newly recovered deposits can overtake an active withdrawal

Status: fixed in this branch.

Symptom: seeding or recovering a withdrawal followed by a deposit can leave the deposit out of the visible queue at first. On the next refresh, the deposit can become the main-lane operation while the still-unclaimed withdrawal moves to the queue.

Debug-mode check: this is not a mock backend ordering hack. The mock backend returns realistic SDK-style pending action states. The bridge was treating a debug refresh as an initial recovery rebuild and did not merge newly recovered operations into the existing active lane.

Cause: `RefreshOperations` used the initial `FIND_OPERATIONS` path, which rebuilds recovered main-lane operations with deposits first. During refresh sync, newly recovered operations that did not already have local actors were also ignored, so the UI could either miss the new deposit or later rebuild it ahead of the active withdrawal.

Fix: route `RefreshOperations` through the refresh sync path, keep any existing active main operation at the front of the recovered main lane, and spawn newly recovered operations as paused queued actors behind it.
