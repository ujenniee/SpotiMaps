# SpotiMaps

## Overview

SpotiMaps is a music-tracking application that connects Spotify listening history with users' locations. By matching songs to GPS coordinates using timestamps, SpotiMaps creates an interactive, genre-colored map showing where users listen to their favorite music.

## Goals

- Automatically associate Spotify listening history with locations.
- Display listening history on an interactive, genre-colored map.
- Allow users to share their music maps with friends and on social media, while maintaining control over what they share.
- Provide a personalized music journal of users' listening experiences, including a SpotiMaps Wrapped summary of their listening habits.

## Repository Structure

The repository contains an Expo frontend and Supabase migrations for authentication
data and listening history. See the backend setup below to run the current flow.

## Backend and local setup

The app uses one Supabase project for both authentication and its PostgreSQL
database; a separate database or custom API server is not required for the
current login and listening-history flows.

- Supabase Auth owns credentials and user identity in `auth.users`.
- `public.profiles` stores app-facing profile data. A database trigger creates
  the profile when an Auth user is created and keeps its email in sync.
- `public.listening_history` stores Spotify plays, keyed to `auth.users.id`.
  Row-level security restricts profile and play data to the signed-in user.
- The Expo app connects with the project's URL and public anon key. Supabase
  Auth persists the session on-device, and the client sends it with database
  requests. Never put a service-role key in the app.

To run locally:

1. Install the Supabase CLI and run `supabase start` from the repository root.
   The CLI applies the migrations under `supabase/migrations`.
2. Copy `frontend/.env.example` to `frontend/.env` and set
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the local
   Supabase API URL and anon key printed by `supabase status`.
3. Start the app from `frontend` with `npm start`. For a hosted project, apply
   migrations with `supabase link` and `supabase db push`, then use that
   project's URL and public anon key instead.

Email/password login is Supabase Auth, not Spotify OAuth. The "Log in" action
authenticates the SpotiMaps account; connecting Spotify is a separate OAuth
step that still needs to be added. Spotify access tokens should not be stored
in a client-readable table. The existing history-sync service requires a
Spotify token and writes plays as the currently authenticated Supabase user.

## Project Documentation

Our living project document contains our proposal, requirements, use cases, and technical plans.

[SpotiMaps Living Document](https://docs.google.com/document/d/1Cl6B0zDl8BeFt6KHLBx0HJFWDZn0Jm3kjM20igtxUGI/edit?tab=t.b2b15vxtdlae)

## Team

- Aidan Bucerzan — Backend
- Jennie Ung — Backend
- Emily Phan — Frontend
- Kairo Montes-Escamilla — Frontend
- Harley Zhu — Frontend/Backend
