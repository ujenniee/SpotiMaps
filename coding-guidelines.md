Coding Guidelines
React Native + Expo (JS/Typescript) https://github.com/airbnb/javascript?utm_source=copilot.com
JavaScript/TypeScript style standard in industry - covers naming, formatting, React patterns, and best practices that apply directly to React Native. Enforced by adding ESLint with eslint-config-airbnb, and requiring all PRs to pass linting in GitHub Actions CI.

React Native + Supabase (Typescript) https://github.com/microsoft/TypeScript/wiki/Coding-guidelines
Official style guideline for TypeScript. Defines naming conventions, type usage, and structural patterns. Enforced by enabling strict mode in tsconfig.json. PR reviewers check for correct naming and typing conventions.

SQL + Postgres (Supabase) https://www.sqlstyle.guide/?utm_source=copilot.com
Covers naming conventions, formatting, capitalization, and query structure, which are all applicable to Supabase’s PostgresSQL environment. Enforced by requiring SQL migrations to follow naming conventions.

Supabase Backend (JavaScript/TypeScript client + API) https://supabase.com/docs/reference/javascript
Supabase’s official documentation which includes patterns for queries, error handling, and client usage. Enforced by requiring all database interactions to use typed Supabase client methods and having PR reviewers check for correct error handling and query patterns.

Spotify API https://developer.spotify.com/documentation/web-api/
Official API documentation which includes required patterns for authentication, rate limiting, and error handling. Enforced by adding PR checklist items for rate limiting, and enforcing correct OAuth flow and token refresh logic.
