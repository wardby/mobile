# Wardby mobile

A React Native / Expo app for iOS and Android that gives wardby admins a read-only, live view of their own wardby server (runs, run details, spend, push alerts). It talks only to the wardby server you choose at sign-in.

## Run it

```sh
npm ci
npx expo start
```

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run export
```

## White-label builds

`app.identity.ts` is the only place that names the app: `name`, `slug`, `scheme`, `iosBundleId`, `androidPackage` and the optional `easProjectId`. `app.config.ts` reads it. Edit that file to produce a differently branded build.

The OAuth redirect the app uses is `<scheme>:/oauth` (see `redirectUri()`). The wardby server must allow the build's redirect: set `WARDBY_MOBILE_ENABLED=true` and, for a non-default scheme, `WARDBY_MOBILE_REDIRECT_URI=<scheme>:/oauth`.

## License

Apache License 2.0. See `LICENSE`.
