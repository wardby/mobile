# AGENTS.md

Rules for every change to this repository. Every change is made by a coding agent from a GitHub issue.

## What the app is

The wardby mobile app: a React Native / Expo app (TypeScript) for iOS and Android that gives wardby admins a read-only, live view of their own wardby server (runs, run details, spend, push alerts). It talks only to the wardby server the user chooses at sign-in.

## Expo has changed — do not trust your training data

Read the `expo` major version from `package.json` and use the matching versioned docs, `https://docs.expo.dev/versions/v<major>.0.0/`, and `https://docs.expo.dev/llms.txt`. Never answer Expo or React Native API questions from memory.

## Dependencies

Use `npx expo install <pkg>` for every dependency. Never use `npm install <pkg>`.

## Installing dependencies

- Run `npm ci` once at the start of a task.
- Don't run `npm install` or `npm ci` again unless `package.json` or `package-lock.json` changed in this task.
- To add a dependency, use one `npx expo install <pkg>` (add `-- --save-dev` for a dev dependency), and don't reinstall afterwards.
- Never run two install commands at the same time.
- Scripts must never install dependencies or download tools at run time. Use installed binaries directly or `npx --no-install`; any script tool must be a devDependency.
- `api:sync` may fetch the pinned CLI tarball with `npm pack`, but must leave `node_modules` and `package-lock.json` untouched.

## Native code

Never create or edit `ios/` or `android/` (Continuous Native Generation). Configure native behaviour in `app.config.ts` and config plugins.

## Layout

- `app/`: routes (Expo Router).
- `src/api/` and `src/auth/`: the only code that talks to the network or calls `fetch`.
- `src/`: hooks and components.
- `app.identity.ts`: the only place that names the app (name, slug, scheme, bundle id, package).

## Definition of done (every ticket)

- `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` pass.
- The app bundles: run `npm run export -- --platform web` in the coding sandbox. CI's `ci` check runs the full `npm run export` (iOS, Android and web) on every pull request.
  - In the coding sandbox, `npm run export -- --platform web` takes about **2–3 minutes**. Run it **once**, in the foreground. Don't wrap it in your own `timeout`, and don't run it in the background and poll.
  - Run it **last**, after typecheck, lint, format:check and tests pass, so a failure earlier doesn't waste an export.
  - If it fails, read the error output from that run before deciding to run it again.
- Every new hook and screen has tests.
- Network code is tested against recorded fixtures, never a live server.
- The PR body says `Resolves #<issue>` and copies the ticket's acceptance checklist with each item ticked.
- The PR includes a short "How to try it" section.

### When to run the full export

Run the full `npm run export` locally (not just web) when the change:

- touches `app.config.ts` or `app.identity.ts`;
- adds or changes a platform-specific file (`*.ios.*`, `*.android.*`, `*.native.*`);
- adds or upgrades a dependency (any `package.json` change);
- fixes a `ci` failure in the export step.

## Never

- Never change anything under `.github/` (CI is maintained by the repository owner).
- Never put secrets or tokens in the repo or tests.
- Never hardcode a server host.
- Never add analytics, crash reporting, or anything that sends data anywhere except the user's own wardby server.
- Never add new top-level dependencies the ticket didn't ask for without saying why in the PR.

## Accessibility

Every control has an accessible label. Every control a test touches has a `testID`.

## API contract

Run `npm run api:sync` to extract the viewer OpenAPI contract from the pinned
`@wardby/cli` package, then `npm run api:generate` to regenerate its TypeScript
schema. `src/api/openapi.yml` and `src/api/schema.ts` are generated: never edit
these files by hand. Commit both outputs together. Bump `CLI_VERSION` in
`src/api/sync-contract.cjs` to pick up API changes, then refresh the fixtures and
run all checks. The schema freshness test checks the generated types against the
vendored contract.

## Auth

- Tokens live only in `expo-secure-store`.
- Nothing logs tokens.
- Auth code lives in `src/auth/`.
- Network calls stay in `src/api/` and `src/auth/` only.

## Live data

- Screens get runs only from `useLiveGraph()`, never by polling. `LiveGraphProvider` (in the signed-in tabs layout) keeps one event stream for the whole app.
- Event-stream code lives in `src/live/`; it is the only network code outside `src/api/` and `src/auth/`.
- Open the event stream first, then load the graph, then apply events on top. On every `resync` and after every reconnect, refetch the graph instead of trying to resume (there is no replay).

## UI patterns

- Use `ExternalLink` from `src/ui/interactions.tsx` for anything that opens the browser; it supplies the accent, external marker and browser accessibility hint. Inline Markdown result links (#28) are nested Text and cannot contain the Pressable used by ExternalLink; they use Text with the same accent, ↗ marker, browser hint and pressed opacity, while retaining URL vetting.
- Use `NavigationRow` for full-row in-app navigation; only in-app navigation uses a trailing `›`.
- Use `TextButton` for inline actions, filters and buttons. Pass `expanded` for disclosures to get the state and flipping indicator. Keep existing labels and testIDs.
- Use `useColors().tint` only for interactive elements. The shared controls provide minimum 44×44 targets, pressed opacity and Android ripple; retain these when adding styles.

## UI

- Never put a style that must render (border, background, size) in a `style` function passed to `Button` / `Pressable` when the control also has a `className`: NativeWind drops it on device, and Jest cannot catch it (#46, #62). Use theme-token classes (`border-border`, `bg-fill`, `bg-accent`, …) instead.

- A control that opens a menu uses `MenuButton`; `TextButton` is for actions.

- The app's light/dark mode comes from `src/settings/appearance.ts` (`Appearance.setColorScheme`); never read or override the scheme anywhere else.

- New UI uses the gluestack components in `components/ui/` and Tailwind `className` for layout, spacing and typography. Colours come from `useColors()`/`statusStyle()` inline styles backed by the single theme, including native platform colours. Don't use ad-hoc `StyleSheet` colours.
- Use the accent colour only for interactive elements.
- Add component files by hand under `components/ui/`; don't use the gluestack CLI.
- Run the full `npm run export` whenever this setup changes.
