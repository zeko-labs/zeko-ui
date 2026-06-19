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

## Bug 3: Completed rows can be shown before backend terminal verification

Status: fixed in this branch.

Symptom: after a claim/finalize transaction succeeds locally, the bridge UI can move an operation into completed transactions even though `findPendingOperations` does not yet report the matching bridge action as `finalised` or `cancelled`. After a page refresh, the same operation can reappear as confirming because fresh UI state is rebuilt from backend recovery data.

Debug-mode check: this must be verifiable with the mock backend using realistic SDK-shaped answers. The `repro-unindexed-withdrawal-completion` scenario returns multiple pending operations, `canFinalizeDeposit` / `canFinalizeWithdrawal` results scoped by bridge action `index`, and a delayed recovery terminal state. The bug is not considered fixed unless debug mode can show a claimed operation in completed transactions with a yellow `Unindexed` label, then upgrade it to verified completed only after `findPendingOperations` returns the matching terminal action.

Cause: the UI currently conflates local operation flow completion with backend terminal verification. `canFinalizeDeposit` and `canFinalizeWithdrawal` are account-level capability checks; with several queued operations they can refer to a different bridge action than the active UI card. The discriminant for applying capability and terminal progress is the bridge action index, with submit transaction hash used only to bind a freshly submitted local operation to recovered SDK state.

Fix: track the bridge action index on operation actors, apply `canFinalizeX` / `alreadyFinalised` only when the returned `index` matches the operation, move locally claimed operations to completed transactions as yellow unverified rows so the queue can continue, and upgrade them to verified completed only from matching `findPendingOperations` terminal state.

Follow-up fix: terminal `findPendingOperations` recovery still matches local actors by operation id first and transaction hash second, but it now refuses to verify an actor that already has a different bridge action index. This prevents a coherent id/hash match from silently overwriting the actor's known index and marking the wrong completed row as verified.
