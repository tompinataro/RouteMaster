#!/usr/bin/env markdown
# Sprint 17 — Performance (2h)

- Goal: Reduce startup and re-render cost.
- Tasks:
  - Lazy load screens; memoize heavy components.
  - Prefetch routes on auth; use FlatList optimizations.
- Acceptance:
  - Cold start: web < 2s, iOS < 4s; smooth list scroll.
- Dependencies: none
- Status: In Progress → Implemented web app route-level code splitting, prefetch, and memoization.

## Changes Implemented
- Web (Vite + React Router v5):
  - Route-level code splitting via `React.lazy` and `Suspense` in `src/components/App/App.jsx`.
  - Prefetch likely next screens after auth (`YourRoutePage`, `ClientVisitPage`).
  - Memoized client list buttons and stable keys in `src/components/2YourRoutePage/YourRoutePage.jsx` to reduce re-renders.
- Mobile (Expo RN):
  - Memoized `RouteListItem` rows and handlers in `mobile/src/screens/RouteListScreen.tsx` to reduce unnecessary re-renders.
  - Preserved checkmark animations while memoizing the `Check` badge.

## Next Candidates (Optional)
- Web: Prefetch admin routes upon navigating to `/AdminLandingPage`.
- RN: Memoize `renderItem` with `useCallback` and provide `getItemLayout` if list grows large.
