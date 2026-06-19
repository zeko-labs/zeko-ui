# Bridge Bugs

## Bug 1: Claimed deposits can block the main queue

Status: fixed in this branch.

Symptom: a deposit can remain the active queue head after it has been claimed and moved to completed transactions. The next main operation stays paused, so the bridge form becomes usable again even though queued work remains. Sim Refresh rebuilds recovered state and can make the next operation continue.

Cause: recovery sync included local entries whose actor status was already completed when rebuilding pending operations from SDK action state. If the completed entry appeared first, it was assigned `started` again and blocked the next pending operation from becoming active.

Fix: exclude locally completed entries before assigning recovered pending queue order and active status.
