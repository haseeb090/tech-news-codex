# Improvements Roadmap

## 1. Local Dockerized Ingestion + Admin Runtime
- Run the app server locally in Docker so the admin interface is always available on the machine.
- Run scheduled ingestion from the same local stack every 3 hours.
- Keep the stack restart-safe with Docker restart policies so it comes back after machine or Docker daemon restarts.
- Bind the admin-capable app only to localhost so it is not reachable from the public network.
- Disable admin routes, admin APIs, and admin navigation on the deployed/public version.

## 2. Public Reader Accounts and Signup Tracking
- Add secure email/password signup and sign-in for public readers.
- Keep using NextAuth for sessions, with separate reader/admin roles.
- Track signups in the database so growth can be measured later.
- Let anonymous visitors browse only a teaser experience on the homepage.
- Show only 5 articles initially for anonymous users.
- Gate `View more` and article access behind a signup/sign-in modal.

## 3. Feed UX and Theme System
- Introduce multiple selectable visual themes for the public feed.
- Make the homepage feel more polished, animated, and memorable.
- Improve content browsing flow so readers want to stay and return.
- Keep interactions smooth and seamless, especially around modal auth gates and theme switching.

## Implementation Notes
- Preserve the existing Turso-backed ingestion pipeline and LangGraph extraction workflow.
- Keep database growth bounded with retention logic.
- Do not expose the local admin surface on the deployed public site.
