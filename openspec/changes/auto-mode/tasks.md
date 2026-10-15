# Tasks

## 1. Auto programme domain

- [x] 1.1 Add auto-programme constants (phase durations, peak mill/hub power) to `RideParameters` and document the timeline and rationale in `docs/` plus `docs/appendix-parameters.md`; verify the documented values match the constants
- [x] 1.2 Add `AutoModeState` and the `AutoProgramme` domain type (pure function of elapsed time → phase and power setpoints); verify xUnit tests cover ramps, cruise hold, phase boundaries and determinism
- [x] 1.3 Integrate the programme into `Ride`: start from `Safe`, apply setpoints in `Advance`, hand off to `Stopping` at the end, stop-auto, clear on rest/Emergency Stop; verify domain tests for each spec scenario of start, stop, emergency stop and completion
- [x] 1.4 Add the manual-control lock (`EnsureManualControl`) to every manual mutator and to `Started`/`Stopping` requests, and drop those from `AvailableTransitions` while active; verify tests that each guarded operation is rejected during auto and accepted after
- [x] 1.5 Add a full-run test asserting mill and hub speeds stay below the warn thresholds (15 / 26 rpm) from start to rest; verify it passes

## 2. Backend surface

- [x] 2.1 Add `AutoModeTelemetry` to `DigitalTwin.Abstractions`, populate it in `Ride.ToTelemetry`; verify telemetry tests for idle, running and unavailable states
- [x] 2.2 Add `StartAutoMode` and `StopAutoMode` feature slices (command + handler with `ExecuteAsync`, `EnrichActivity`, ADR-0009 metrics); verify handler tests including rejection paths
- [ ] 2.3 Map `POST /ride/auto/start` and `POST /ride/auto/stop` in `DigitalTwinEndpoints` with 400 on `DomainValidationException`; verify endpoint tests and that `dotnet test` on the DigitalTwin test project passes with module line coverage ≥ 80 %

## 3. Dashboard

- [ ] 3.1 Extend the telemetry/lifecycle models and service with `autoMode` and `startAuto()/stopAuto()`; verify Vitest specs for mapping and HTTP calls
- [ ] 3.2 Add Start auto / Stop auto buttons (PrimeNG, per the `primeng` MCP server) to `operation-controls` and disable power sliders, direction toggles and brake while auto is active with a visible message; verify component specs for each button state and the locked controls
- [ ] 3.3 Confirm `status-summary` disables `Stopping` and keeps Emergency Stop enabled during auto; verify with a spec
- [ ] 3.4 Add `*.a11y.spec.ts` coverage for the auto-mode controls (active and inactive); verify AXE passes with no violations

## 4. Integration

- [ ] 4.1 Run `dotnet build BoogaBooster.slnx && dotnet test BoogaBooster.slnx` and `npm test` in the Angular app; verify all pass
- [ ] 4.2 Run `openspec validate auto-mode` and, if CLAUDE.md or the Status/capability notes changed, `node .claude/skills/ai-tooling-sync/scripts/sync-ai-tooling.mjs`; verify no errors

## Workflow follow-up

- Archive the change on `development` (`/opsx:archive auto-mode`) after the implementation PR is merged.
