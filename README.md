# AI Reef Doctor

Experimental as-is source for a reef aquarium web app and iOS-oriented Expo app, with shared TypeScript code. The repository contains UI and service code for tank records, parameter history, reminders, care tools, and AI-assisted guidance. Bugs, incomplete features, and outdated dependencies may remain.

## Requirements and configuration

The root package declares Node.js 20 or newer and pnpm 10.31.0. Copy `.env.example` to `.env.local` and replace its synthetic placeholders locally. Copy `apps/mobile/.env.example` to `apps/mobile/.env` for the mobile app. Do not commit real credentials; mobile `EXPO_PUBLIC_*` values are bundled into the client and must never contain service-role keys.

The source declares these commands; they were not run for this sanitation snapshot:

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm test:run
pnpm --filter @reef/mobile start
```

## Limits

No install, build, test, demo, service, hosted, simulator, or device behavior was verified for this snapshot. The legal pages are draft templates with synthetic contact placeholders. The mobile image assets are plain dark placeholders. The Stripe API-version suffix and product URL are synthetic and unverified. Mobile demo mode uses the reserved example.invalid URL; configure a valid project URL before enabling Supabase. Treat the application and its educational guidance as experimental and verify all behavior and advice independently.

## License

MIT; see [LICENSE](LICENSE).
