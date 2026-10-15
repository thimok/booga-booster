## Why

Every ride cycle today is flown by hand: the operator must raise the mill and hub power sliders, hold a sensible cruise, bring the power down and apply the brakes at the right moment. That is repetitive, error-prone and makes the ride impossible to demo hands-free. A predefined **auto mode** lets one button run a complete, repeatable ride sequence while keeping an operator-controlled way out.

## What Changes

- Add a predefined, deterministic **auto programme** that runs the whole ride sequence on the server: spin-up of the mill and hubs, a cruise phase, a wind-down, and the final brake-to-rest. It drives motor power and brakes itself — no operator input.
- Add a **Start auto** action. It is accepted only when the ride is `Safe` (ready to start); it starts the ride and begins the programme.
- Add a **Stop auto** action, accepted only while auto mode is running. It aborts the programme, cuts power and applies the brakes (a controlled `Stopping`), after which the ride comes to rest and offloads as usual so riders can disembark.
- While auto mode is running, **manual control is locked**: power, direction and brake commands, and the manual lifecycle transitions, are rejected by the server and their controls are disabled in the dashboard. Emergency Stop remains available at all times.
- Auto mode ends when the programme completes (or is stopped) and the ride has come to rest; manual controls are then available again according to the normal lifecycle rules.
- Expose auto-mode status (active, current phase, whether start/stop are available) in the ride telemetry.
- Add **Start auto** / **Stop auto** buttons to the operator dashboard; Start auto is enabled only when it is legal, Stop auto only while auto mode runs.

## Capabilities

### New Capabilities
- `ride-auto-mode`: the predefined ride programme, its start/stop actions, the manual-control lock while it runs, its telemetry, and the server endpoints that drive it.

### Modified Capabilities
- `ride-operation-controls`: adds the Start auto / Stop auto buttons and disables the manual power, direction and brake controls while auto mode is running.
- `ride-state-machine`: operator-triggered `Started` and `Stopping` requests (and the status-summary buttons for them) are refused while an auto programme owns the ride.

## Impact

- **Backend (`DigitalTwin` module)**
  - `Domain/` — an auto-programme model (phases, timeline) advanced from `Ride.Advance`; `Ride` gains start/stop-auto operations and the manual-control lock.
  - `Domain/RideParameters.cs` — programme timings and peak power setpoints (no magic numbers), with derivation in `docs/`.
  - `Features/StartAutoMode`, `Features/StopAutoMode` — new command slices with ADR-0009 instrumentation.
  - `Endpoints/DigitalTwinEndpoints.cs` — `POST /ride/auto/start`, `POST /ride/auto/stop`.
  - `DigitalTwin.Abstractions` — auto-mode telemetry on `RideTelemetry`; request/response DTOs per the `dto-organization` skill.
  - Tests: new xUnit coverage in the DigitalTwin test project (domain programme, handlers, endpoints).
- **Frontend (`FourDotnet.BoogaBooster.App`)** — telemetry model, lifecycle/state services, `operation-controls` and `status-summary` components, Vitest and `axe-core` specs. New UI uses PrimeNG.
- **Docs** — `docs/` gains the programme's timeline and parameter rationale; `docs/appendix-parameters.md` lists the new constants.
- No new dependencies; no cross-module or messaging changes.
