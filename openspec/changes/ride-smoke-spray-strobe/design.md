# Design

## Context

The ride is drawn by `RideVisualization` (Three.js, created in `afterNextRender`, scene fog, hemisphere + sun lights, disposed via `disposeScene`). Weather arrives as signals from `WeatherStateService` (`WeatherConditions`: temperature, Beaufort, regime). The left rail hosts `OperationControls`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Smoke, water spray and strobe rendered inside the existing scene with no new dependencies.
- Operator toggles + intensity, weather-coupled, strobe provably within 3 Hz.
- Pure, unit-testable logic separated from Three.js objects.

**Non-Goals:**
- No backend, telemetry, persistence or physics change; no server-side effect state.
- No sound, no per-gondola effects, no effect scripting from auto mode.

## Decisions

1. **Client-side state in `EffectsStateService`** (signals: `smoke`, `spray`, `strobe` each `{enabled, intensity}`; `computed` effective values). Alternative — server-held state and an API — rejected: effects are presentation, and a backend round trip adds nothing and risks coupling them to the deterministic simulation.
2. **Pure helpers in `effects.models.ts`**: `clampIntensity`, `strobeFlashHz(intensity)` (linear 0.5→`MAX_STROBE_HZ = 3`, hard-capped), `strobeLevel(timeSeconds, intensity)` (square pulse with ≤ 3 Hz duty), `sprayBlockedReason(conditions)` (`'freezing' | 'strong-wind' | null`), `smokeDrift(beaufort)`. All visual constants named, no magic numbers inline. Keeps the safety-critical cadence testable without WebGL.
3. **Particles as `THREE.Points` with a preallocated `BufferGeometry`** (one for smoke with a soft sprite texture and normal blending, one for spray with additive-free small points), updated per frame in the existing render loop from a delta time. Alternative — a particle library — rejected (new dependency). Particle counts are fixed caps scaled by intensity via `setDrawRange`, so no per-frame allocation. Visual randomness uses a small seeded PRNG, separate from the simulation's samplers, so tests are repeatable.
4. **Strobe = a `PointLight` plus a brief boost of hemisphere intensity**, driven by `strobeLevel`. Brightness peak is capped below full white and flash edges are not pure black→white, reducing luminance contrast. Alternative — full-screen CSS overlay — rejected: it would flash the whole dashboard UI, not just the scene.
5. **Photosensitivity safeguards**: off by default, never persisted (always off on reload), visible warning text, `prefers-reduced-motion` read through `matchMedia` and exposed as a signal; when set, the toggle is disabled and `effective` strobe is forced off. Cap enforced in the helper, not only in the UI.
6. **Weather coupling**: `RideVisualization` takes weather as an `input()`. Spray suppression and smoke drift derive from the pure helpers; `EffectsControls` shows the suppression reason via the same helper.
7. **UI**: `EffectsControls` standalone OnPush component using PrimeNG `ToggleSwitch` and `Slider` (consult the `primeng` MCP server for the exact API before use), hosted in the dashboard's left rail as a labelled region.
8. **Disposal**: new geometries, materials, textures and lights are added to the scene and torn down by the existing `disposeScene`; the effect update is skipped when nothing is enabled.

## Risks / Trade-offs

- [Strobe can trigger photosensitive seizures] → ≤ 3 Hz hard cap, opt-in, warning, reduced-motion lockout, off on load, unit tests on the cap.
- [Particle cost on weak GPUs] → fixed caps, preallocated buffers, work skipped while disabled.
- [Visual quality only checkable by eye] → unit-test the pure logic and the state; verify rendering manually in the running app.
- [jsdom has no WebGL] → visualization specs already tolerate this; new scene code is guarded by the same initialisation path.
