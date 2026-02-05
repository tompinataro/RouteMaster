#!/usr/bin/env markdown
# Sprint 15 — Accessibility Pass (2h)

- Goal: Ensure basic a11y: roles, labels, hit areas, dynamic text.
- Tasks:
  - Verify labels on Map button, check badges, back arrow.
  - Increase hitSlop; test with large text settings.
- Acceptance:
  - VoiceOver/TalkBack describes key UI; no unreachable controls.
- Dependencies: none
- Status: In Progress → Implemented RN improvements in RouteList and VisitDetail.

## Changes Implemented
- Mobile (Expo RN):
  - Added `hitSlop` and `accessibilityHint` to Route list card and Map button.
  - Added descriptive `accessibilityLabel` for completion badge with memoization preserved.
  - Set `accessibilityState={{ checked: ... }}` and increased `hitSlop` on checklist rows in Visit Detail.
  - Button component now sets `accessibilityLabel` (defaulting to title) and `hitSlop={12}` globally.
- Web: Button labels remain readable and semantic; no dev-only text.

## Next Checks (Manual)
- iOS VoiceOver: Focus order on Route list; Map button announces hint.
- Android TalkBack: Checklist rows toggle via row tap and Switch.
- Dynamic Type: Increase system text size and ensure no truncation critical to flow.
