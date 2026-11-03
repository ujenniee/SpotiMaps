# SpotiMaps

## Overview

SpotiMaps is a music-tracking application that connects Spotify listening
history with users' locations. By matching songs to GPS coordinates using
timestamps, SpotiMaps aims to create an interactive, genre-colored map showing
where users listen to their favorite music.

## Project status

The current app includes an Expo frontend, Supabase email/password
authentication, database migrations for user profiles and listening history,
and services for location and Spotify listening-history data. Some screens and
flows are still prototypes or use mock data. Spotify OAuth and a complete
end-to-end flow from Spotify through location matching to the map are not yet
available. See the [weekly reports](./reports/) for the team's latest progress
and plans.

## Repository structure

- `frontend/` - Expo / React Native application and its automated tests.
- `supabase/migrations/` - versioned PostgreSQL schema changes.
- `reports/` - weekly progress reports and plans.
- `.github/workflows/ci.yml` - automated tests on pushes and pull requests.

## Requirements

- Node.js 22.18 or newer in the Node 22 release line, with npm.
- Docker Desktop (or a Docker Engine) to run Supabase locally.
- Android Studio and an Android emulator/device for native Android runs, or
  macOS with Xcode for native iOS runs.

## Install dependencies

From the repository root, install the Supabase CLI dependency:

```sh
npm ci
```

Then install the app dependencies:

```sh
cd frontend
npm ci
```

The root `package.json` provides the Supabase CLI; the app's scripts and
dependencies are in `frontend/package.json`.

## Configure Supabase

The app uses one Supabase project for authentication and its PostgreSQL
database; a separate database or custom API server is not required for the
current login and listening-history flows.

- Supabase Auth owns credentials and user identity in `auth.users`.
- `public.profiles` stores app-facing profile data. A database trigger creates
  the profile when an Auth user is created and keeps its email in sync.
- `public.listening_history` stores Spotify plays, keyed to `auth.users.id`.
  Row-level security restricts profile and play data to the signed-in user.
- The Expo app connects with the project's URL and public anon key. Never put
  a service-role key in the app or commit it to the repository.

The app requires `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. There is currently no committed
`frontend/.env.example`; create `frontend/.env` and set those values. For local
development:

1. Make sure Docker is running, then from the repository root run:

   ```sh
   npx supabase start
   npx supabase status
   ```

   The local stack applies the migrations in `supabase/migrations/`. Copy the
   API URL and anon key shown by `supabase status` into `frontend/.env`, for
   example:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
   ```

2. Keep the local Supabase stack running while using the app. To stop it later,
   run `npx supabase stop` from the repository root.

For a hosted Supabase project, use its project URL and public anon key instead.
Apply migrations using the team's approved project and credentials; do not
point local development commands at production data.

Email/password login is Supabase Auth, not Spotify OAuth. Connecting Spotify
is a separate step that still needs to be added. The existing history-sync
service requires a Spotify token and writes plays as the currently
authenticated Supabase user.

## Run the app

From `frontend/`, with dependencies installed and `frontend/.env` configured,
start Expo:

```sh
npm start
```

Use the Expo terminal menu to open the app in an available emulator or device.
The package also provides `npm run android`, `npm run ios`, and `npm run web`.
Native Android and iOS targets require their respective development tools and
devices/emulators.

## Build

For a local native development build, run the matching command from
`frontend/`:

```sh
npx expo run:android
npx expo run:ios
```

Android requires Android Studio and an installed SDK/emulator; iOS requires
macOS and Xcode. These commands generate native project files when needed.
There is not yet a configured production/release build or signing workflow.

## Test

From `frontend/`, run the same automated test command used by CI:

```sh
npm test -- --ci
```

This runs the Node tests (`npm run test:node`) and Jest/React Native tests
(`npm run test:jest`). The Node tests require Node 22.18 or newer. To run the
TypeScript type check locally:

```sh
npx tsc --noEmit
```

GitHub Actions uses Node 22, runs `npm ci`, and runs `npm test -- --ci` on
pushes and pull requests targeting `main`.

## Keeping project documentation current

Treat this README as the source of truth for getting a fresh checkout running.
When a change affects dependencies, environment variables, build/run commands,
tests, Supabase migrations, or CI, update the corresponding instructions in
the same change and verify them from the documented working directory. Keep
the weekly reports focused on progress, completed work, blockers, and next
steps; update the project status above when a major flow becomes usable or a
stated limitation changes. Do not document planned features as implemented.

## Project documentation

The team's living document contains the proposal, requirements, use cases, and
technical plans.

[SpotiMaps Living Document](https://docs.google.com/document/d/1Cl6B0zDl8BeFt6KHLBx0HJFWDZn0Jm3kjM20igtxUGI/edit?tab=t.b2b15vxtdlae)

## Team

- Aidan Bucerzan — Backend
- Jennie Ung — Backend
- Emily Phan — Frontend
- Kairo Montes-Escamilla — Frontend
- Harley Zhu — Frontend/Backend
