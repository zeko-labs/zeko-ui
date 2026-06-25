# T443 - Release post-submit failures

## Requirement

Codex review found that post-submit bridge operation failures can leave the parent bridge `activeOperation` pointing at a final `FAILED` child actor. Fix the parent/child cleanup path so failed operations that already reached the backend/chain phase release the active slot and queued transfers can continue, while preserving the failed actor so the UI can still display the failure.

## Scope

- Cover a realistic recovered claim failure using the debug backend `repro-claim-failure` scenario.
- Do not delete post-submit failed actors from the bridge state.
- Keep pre-submit failures removable from the operation list.

## Test Plan

Method: TDD.

1. Add a failing unit test that seeds a recovered operation, triggers a claim failure, and asserts the parent bridge no longer keeps that operation as active while the failed actor remains available.
2. Implement the state-machine cleanup.
3. Run the targeted bridge refresh queue tests, then bridge-ui test/typecheck/lint validation.

## Result

Added a regression test for `repro-claim-failure` on a recovered withdrawal claim. Added parent bridge `FailOperation` handling so post-submit failures are marked inactive without deleting the failed actor, while pre-submit failures still terminate and clear their actor.

Validation:

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts`
- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts`
- `moon run -f bridge-ui:format-fix`
- `moon run -f bridge-ui:test`
- `moon run -f bridge-ui:typecheck`
- `moon run -f bridge-ui:lint`
- `git diff --check`
