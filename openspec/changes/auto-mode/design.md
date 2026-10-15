# Design

## Context

The `Ride` aggregate (DigitalTwin) owns the lifecycle state machine and advances the deterministic 1/120 s physics in `Ride.Advance`; motor power and brakes are set through `Ride`/`GreatMill`. Today power and brakes are set only by operator commands (`SetMainEnginePower`, `SetHubEnginePower`, `BrakeEngines`, …) and the lifecycle by `RequestTransition`. The dashboard polls lifecycle state via `RideLifecycleService` and gates `operation-controls` on `started`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A deterministic, server-side programme that drives power and brakes from simulation time.
- Server-enforced lock of manual control; the UI only mirrors it.
- Reuse the existing `Stopping` → `Offloading` → `Idle` flow for the end of a run.

**Non-Goals:**
- Operator-editable or multiple programmes; a single fixed programme only.
- Auto-loading or auto-dispatching the ride (start still requires a `Safe` ride).
- Changing physics, restraint or boarding behaviour.

## Decisions

**D1 — The programme lives in the `Ride` aggregate, advanced from `Advance`.** A small domain type `AutoProgramme` (phase + elapsed time) is owned by `Ride`. Each `Advance(dt)` while auto is active computes the setpoints for the new elapsed time and applies them through the same `_mill` setters the manual commands use. Alternatives: a separate `BackgroundService` issuing commands (rejected — breaks determinism, depends on wall-clock timing and races the tick) or client-driven automation (rejected — the dashboard may close and physics is server-authoritative).

**D2 — Programme is a pure function of elapsed simulation time.** Phases: `SpinUp` → `Cruise` → `WindDown` → handoff to `Stopping`. Setpoints are linear ramps between 0 and the peak values; no randomness, no wall-clock. Timings and peaks are constants in `RideParameters` (rule: no magic numbers) with rationale in `docs/`. Peaks are chosen below the over-speed warn thresholds (mill 15 rpm, hubs 26 rpm) of the `passenger-safety` proposal so the two compose; a test runs the whole programme and asserts speeds stay under them.

**D3 — Auto state is explicit: `AutoModeState { Inactive, SpinUp, Cruise, WindDown, Braking }`.** `IsAutoActive` is true from start until the ride reaches rest (`Braking` covers `Stopping` after programme end or stop-auto). It clears when the ride enters `Offloading`/`Idle`, or immediately on Emergency Stop. This matches "manual controls disabled until the ride sequence is done".

**D4 — Start/stop are dedicated commands, not new lifecycle states.** `StartAutoModeCommand` requires `Safe`, performs the `Safe → Started` transition through the existing guarded path, then arms the programme. `StopAutoModeCommand` requires auto active and performs `Started → Stopping` (power cut + brakes via the existing entry side-effect), setting state `Braking`. Alternative of adding an `Auto` lifecycle state was rejected: it would multiply the transition table and the spec'd state buttons for no behavioural gain.

**D5 — Manual lock is enforced in the aggregate.** `Ride` guards each manual mutator (`SetMainEnginePower`, `SetHubEnginePower`, directions, `SetEngineBrakes`, `SetGondolaBrake`) and `RequestTransition` to `Started`/`Stopping` with a `DomainValidationException` (→ 400) while auto is active. `EmergencyStop` is exempt and clears auto. The programme itself calls the internal mill methods, bypassing the guard. `AvailableTransitions` drops `Stopping` (and `Started`) while auto is active so the UI follows from telemetry.

**D6 — Telemetry carries an `AutoModeTelemetry` record** (`IsActive`, `Phase`, `CanStart`, `CanStop`) on `RideTelemetry`; the UI derives button state purely from it. Request/response DTOs and the telemetry record live in `DigitalTwin.Abstractions` (dto-organization skill); endpoints `POST /ride/auto/start|stop` live in `DigitalTwinEndpoints` and dispatch to the two handlers, which extend the CQRS base classes and enrich their activity per ADR-0009.

**D7 — Frontend.** `RideLifecycleService` (or a thin `AutoModeService`) exposes the `autoMode` signal from the polled telemetry and `startAuto()/stopAuto()` posting to the new endpoints. `operation-controls` gains the two buttons (PrimeNG `p-button`, consulting the `primeng` MCP server first) and disables sliders/toggles/brake when `autoMode().isActive`. `status-summary` already derives from `availableTransitions`, so it follows automatically. Power sliders display telemetry power during auto.

## Risks / Trade-offs

- [Programme timings tuned wrongly cause over-speed or a dull ride] → peaks tested against the rpm warn thresholds; values live in `RideParameters` so tuning is one-line.
- [Auto active flag stuck if the ride never reaches rest] → cleared on entering `Offloading`, `Idle` and on Emergency Stop; covered by tests.
- [Polling (1 s) makes buttons lag a transition] → acceptable; the server rejects illegal requests anyway, and the UI refreshes after every request.
- [Guarding every manual mutator is easy to miss for future commands] → one private `EnsureManualControl()` helper used by all mutators, with a test enumerating them.
