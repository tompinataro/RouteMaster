#!/usr/bin/env markdown
# Sprint 16 — Micro‑Animations (2h)

- Goal: Polish interactions (Map button press, ✓ animation, banners).
- Tasks:
  - Map: pressed tint/scale and accessibility feedback.
  - ✓: refine scale/fade timing; ease curves.
  - Banners: consistent entrance/exit timing.
- Acceptance:
  - Interactions feel responsive; no jank.
- Dependencies: none
- Status: In Progress → Implemented RN press/entrance animations and refined ✓ timing.

## Changes Implemented
- Mobile (Expo RN):
  - Route list Map button now scales on press with ease-out; accessible label + hint preserved.
    - File: `mobile/src/screens/RouteListScreen.tsx`
  - Checklist ✓ animation refined (spring speed/bounce + eased fade-in).
    - File: `mobile/src/screens/RouteListScreen.tsx`
  - Global banner now animates: slide-down + fade on show/hide with consistent durations.
    - File: `mobile/src/components/GlobalBannerProvider.tsx`

## Next Candidates
- Subtle card elevation change on press (Route list item).
- Web: add small transition for banners or button hover states.
