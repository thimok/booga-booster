## Why

The 3D ride visualization shows geometry and motion only. A real carnival ride sells its show with atmosphere: smoke machines, water jets and a strobe light. Adding these to the digital twin makes the demo far more convincing, and gives the operator a way to "dress" the ride — while demanding care around photosensitivity, since a strobe is a seizure risk if done carelessly.

## What Changes

- Add three **visual effects** to the Three.js ride visualization:
  - **Smoke** — soft, drifting smoke plumes emitted from the base of the ride, blown downwind according to the current weather.
  - **Water spray** — fine water jets/mist sprayed from the base ring, falling under gravity; suppressed automatically when the weather is freezing or in a strong-wind regime.
  - **Stroboscope** — a flashing white light over the ride that pulses the scene lighting.
- Add an **Effects** control group to the operator dashboard with one toggle per effect (smoke, water spray, strobe), plus an intensity control for each.
- The strobe is **photosensitivity-safe**: it never flashes more than 3 times per second (WCAG 2.3.1), is off by default, requires an explicit opt-in toggle that carries a warning, and is forced off when the user prefers reduced motion.
- Effects are **purely presentational and client-side**: they never alter physics, telemetry or ride state, and they do not need a backend change. Effect settings live in a signal-based state service.
- Effects work in every ride state, so the show can be previewed while the ride is at rest.

## Capabilities

### New Capabilities
- `ride-visual-effects`: smoke, water spray and stroboscope effects in the 3D visualization, their operator controls, their weather coupling, and the photosensitivity safeguards.

### Modified Capabilities
- `ride-dashboard-layout`: the dashboard gains an Effects controls group.

## Impact

- **Frontend only (`FourDotnet.BoogaBooster.App`)**
  - New `effects/` feature folder: `EffectsStateService` (signals), `EffectsControls` component (PrimeNG toggles/sliders), pure effect-model helpers (strobe cadence, spray suppression).
  - `visualization/ride-visualization.ts` — consumes effect settings and weather; adds particle systems and the strobe light, disposed with the scene.
  - `ride-dashboard` template — hosts the Effects controls.
  - Vitest specs for state, helpers and controls; `axe-core` a11y spec for the controls.
- **Backend**: none. No API, messaging or physics changes; determinism of the simulation is unaffected (effects use a visual-only RNG).
- **Docs**: none required.
- No new dependencies (Three.js and PrimeNG are already installed).
