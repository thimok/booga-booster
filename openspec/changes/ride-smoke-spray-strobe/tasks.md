## 1. Effects model and state

- [x] 1.1 Add `effects/effects.models.ts` with named constants (`MAX_STROBE_HZ = 3`, particle caps, drift scale) and pure helpers: `clampIntensity`, `strobeFlashHz`, `strobeLevel`, `sprayBlockedReason`, `smokeDrift`
- [x] 1.2 Add specs for the helpers, including the ≤ 3 flashes/second cap at every intensity and the freezing/strong-wind spray suppression
- [x] 1.3 Add `EffectsStateService` (signals for smoke/spray/strobe enabled + intensity, reduced-motion signal, effective-value computeds; all off by default, never persisted) with specs

## 2. Effects controls UI

- [x] 2.1 Consult the `primeng` MCP server for `ToggleSwitch` and `Slider`, then add the `EffectsControls` component (labelled region, three toggles + intensity sliders, strobe photosensitivity warning, spray-unavailable reason, reduced-motion explanation)
- [x] 2.2 Host `EffectsControls` in the dashboard's left rail below `OperationControls`
- [x] 2.3 Add Vitest specs (toggle, clamping, disabled states, keyboard) and an `effects-controls.a11y.spec.ts` axe-core spec

## 3. Visualization effects

- [x] 3.1 Add smoke particle system (preallocated `Points`, soft sprite, wind drift from weather input) to `RideVisualization`
- [x] 3.2 Add water-spray particle system (droplets arcing from the base ring under gravity, suppressed per `sprayBlockedReason`)
- [x] 3.3 Add the stroboscope (point light + capped lighting pulse driven by `strobeLevel`)
- [x] 3.4 Feed weather and effect settings into `RideVisualization`; dispose all new geometry, materials, textures and lights; skip work while disabled
- [x] 3.5 Extend `ride-visualization.spec.ts` for the new inputs and disposal

## 4. Verification

- [x] 4.1 Run `npm test` and `npm run build` in the Angular app
- [ ] 4.2 Run the app and visually verify smoke, spray, strobe cadence, weather suppression and reduced-motion behaviour
- [ ] 4.3 Run `node .claude/skills/ai-tooling-sync/scripts/sync-ai-tooling.mjs` if any AI-tooling file was touched
