# RouteMaster Logo / Icon Notes

These notes capture the current state of RouteMaster logo assets and preferences so future changes are consistent.

## Where the assets live

All current SVG logo/icon assets are stored here:

- `assets/logos/routemaster/`
  - `routemaster_logo_animated.svg`
  - `routemaster_logo_animated_palette.svg`
  - `routemaster_icon.svg`

## Brand direction (current)

- Product: **RouteMaster** — field tech route management (mobile timeclock/dashboard).
- Visual direction explored:
  - Cartoon-ish “RM vehicle” icon with wheels + implied motion.
  - Profile truck concept with **“RouteMaster”** painted on the side.
- Colors requested:
  - Burgundy: `#7A1E2C`
  - Dusty rose: `#C28A8A`
  - Black/ink: `#111111`
  - White: `#FFFFFF`

## File format

- Prefer **SVG** (Scalable Vector Graphics) for crisp scaling across app icon sizes.
- Animation (when used) is embedded via SVG `animate/animateTransform`.

## Repo hygiene

- Avoid committing local Clawdbot workspace/meta files (e.g., `SOUL.md`, `AGENTS.md`, `tmp/`, `wireframes/`) to the RouteMaster product repo unless explicitly desired.
