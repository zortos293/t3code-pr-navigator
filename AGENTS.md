# Agent Instructions

## Package manager

- Use Bun only.
- Do not use `npm`, `pnpm`, or additional lockfiles.
- Run repository scripts with `bun run <script>`.

## Required command usage

- Use `bun run test`, not `bun test`.
- This project uses Vitest through the package script, so `bun test` would invoke Bun's test runner instead of the intended Vitest workflow.
- Use `bun run test:watch` for interactive Vitest runs.

## Validation commands

- `bun run lint` - full lint pass; runs Oxlint first, then ESLint.
- `bun run lint:oxlint` - fast Oxlint pass.
- `bun run lint:eslint` - Next.js/React ESLint pass.
- `bun run test` - Vitest test suite.
- `bun run build` - production build validation.

## Notes

- Treat Oxlint as the fast first-pass linter and ESLint as the framework-aware follow-up.
- If you update scripts, keep Bun script invocation examples in sync here.
