# AGENTS.md

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9
- pnpm
- App Router (`src/app`)

## Product Reference

- Use `https://zillertal.intermaps.com/zillertalarena?lang=en` as a reference when thinking about the functionality this website should support.
- Use `https://zillertal.intermaps.com/zillertal_uebersicht` as another reference when thinking about the functionality this website should support.
- Use `https://zillertal.intermaps.com/mayrhofen` as another reference when thinking about the functionality this website should support.

## Project Notes

- Project-specific Obsidian notes live in `/home/shoutcape/Documents/Obsidian Notes/AlpNav/`.
- Current known note paths include `AlpNav/MVP Build Checklist.md`, `AlpNav/MVP Scope.md`, and `AlpNav/Feature Log.md`.
- Consult those notes before making architecture or product-direction changes and keep implementation aligned with them.

## Execution Rules

- Build the app in small, incremental steps.
- Keep each task tightly scoped to the user's request.
- Do not bundle unrelated improvements, refactors, or feature ideas into the same change.
- When a larger feature is needed, split it into clear sub-steps and complete only the next smallest useful step.
- Prefer simple, verifiable progress over broad speculative implementation.
- For mobile development and UI verification, use `390x844` (iPhone 12 Pro) as the minimum viewport size target. Maximum is `450x950`
