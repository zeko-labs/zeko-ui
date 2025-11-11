# Instructions

This monorepo hosts Zeko UI apps and libraries.

- NEVER CREATE A SUMMARY DOCUMENT AFTER MAKING CHANGES. NEVER. ABSOLUTELY NEVER.
- ONLY CREATE MARKDOWN DOCUMENTS IF EXPLICITLY ASKED TO DO SO.
- Never say : "You're absolutely right"

## Big picture

This is a monorepo using pnpm as the package manager, and moon as the task runner. The projects are defined in `.moon/workspace.yaml` and `pnpm-workspace.yaml`.

## Common tasks and commands

To install everything, run `pnpm i` from the root.

- Run all command from the root using moon.
- Project tasks are defined in each project’s `moon.yml`. Inspect this file _before_ running any commands in a given project.
- You can disable moon caching by passing the `-u` flag to any command that has cached results.
- If you need to run a command not specified in `moon.yml`, use `pnpm exec <command>`.

## Testing

When writing tests, never attempt to use workarounds to make test pass.
Never attempt to create mocks unless specifically required.
Never try to skip tests or make dumb assertions just to make test pass.
If a test is failing, take your time to investigate why it is failing without jumping to conclusions.
Handle failures one by one, methodologically, and make sure that the tests are sound, and that they verify the intended behavior.
When testing, prefer using the test tool to run the tests.

## Language Instructions

- Always use Typescript instead of Javascript
- Always use plain CSS with the latest features available in postcss. Do not use libraries like Tailwind or Bootstrap. Use PascalCase for class names. Use CSS nesting when authoring styles.
- Always prefer first principles to adding additional libraries. If using a library is necessary, always ask first before adding it, unless the user explicitly ask for a specific library to implement something.

## Nuxt and Vue Instructions

- Match existing coding style.
- Always use composition API with script setup.

## Notes for this monorepo setup

- Bun is only required when running certain scripts; standard builds use Node.
- Prefer Moon over raw pnpm filters for common workflows to keep consistency with CI tasks.

## Coding Style

- NEVER use hacky workaround for the sake of making things works. Be thorough.
- Your code must be clean and not literred with unnecessary comments.
- Avoid mutating variables and prefer immutability.
- Prefer a functional style, avoiding side effects.
- Prefer readability over cleverness.
- Do not be too cavalier when following instructions. If you are unsure about something, ask for clarification.
