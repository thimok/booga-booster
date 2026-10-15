# 6. The Auto Programme

Auto mode flies one complete, fixed ride sequence without operator input. It is **not**
a new physical model — it only chooses the throttle setpoints the operator would
otherwise choose by hand — so it needs no new equations, only a timeline and the
justification for its constants. Every constant lives in `RideParameters` (names in
backticks below).

## 6.1 The timeline

The programme is a **pure function of elapsed simulation time** `t` (seconds since auto
mode started). It holds no randomness and never reads the wall clock, so the same
starting conditions always give the same sequence (doc 1, determinism).

| Phase | Interval of `t` | Mill throttle | Hub throttle |
|-------|-----------------|---------------|--------------|
| `SpinUp` | `[0, T_up)` | `P_mill · t / T_up` | `P_hub · t / T_up` |
| `Cruise` | `[T_up, T_up + T_cruise)` | `P_mill` | `P_hub` |
| `WindDown` | `[T_up + T_cruise, T_total)` | `P_mill · (1 − (t − T_up − T_cruise) / T_wind)` | `P_hub · (1 − …)` |
| `Braking` | `[T_total, ∞)` | 0 (engine brake engaged) | 0 |

with `T_total = T_up + T_cruise + T_wind`. Each phase boundary belongs to the **later**
phase, so the setpoint is continuous across every boundary (the ramps meet the cruise
plateau exactly). `Braking` is not driven by the formula: when `t` reaches `T_total` the
ride performs the normal `Started → Stopping` transition (power cut, engine and gondola
brakes applied) and the programme stays in `Braking` until the ride is at rest.

The mill and hubs receive their setpoints every fixed step, **before** that step's
physics runs, using the same setters the manual commands use.

## 6.2 The constants

| Constant | Symbol | Value | Unit |
|----------|--------|------:|------|
| `AutoSpinUpSeconds` | `T_up` | 30 | s |
| `AutoCruiseSeconds` | `T_cruise` | 45 | s |
| `AutoWindDownSeconds` | `T_wind` | 20 | s |
| `AutoMillPeakPowerPercent` | `P_mill` | 40 | % |
| `AutoHubPeakPowerPercent` | `P_hub` | 40 | % |
| `MillWarnRpm` | — | 15 | rpm |
| `HubWarnRpm` | — | 26 | rpm |

## 6.3 Why these values

* **Peak throttle 40 %.** The terminal speed of the mill is set by the balance of motor
  torque against drag (doc 3 §3.4), and it grows monotonically with throttle. Holding
  each motor at a constant throttle for 90 s on the baseline rig gave the following
  terminal speeds (the empty and fully loaded rigs agree to within a fraction of an rpm,
  because the terminal point is a torque balance, not an inertia effect):

  | Throttle | Mill (rpm) | Hubs (rpm) |
  |---------:|-----------:|-----------:|
  | 30 % | 11.4 | 19.3 |
  | 50 % | 14.6 | 24.2 |
  | 60 % | 15.9 | 26.2 |

  60 % would cross both warn thresholds and 50 % leaves almost no margin, so **40 %**
  (≈ 13 rpm mill, ≈ 22 rpm hubs) is used. The warn thresholds are the over-speed limits
  of the `passenger-safety` proposal; staying below them means a normal auto run never
  triggers a protective stop. The full-run test asserts this at every step.
* **Spin-up 30 s.** The mill needs ~15–25 s to reach cruise at full power (appendix
  sanity check); at 40 % the lower torque is balanced by a slower ramp, and a 30 s
  linear ramp keeps the felt G rise gentle for the riders.
* **Cruise 45 s.** Long enough to feel like a ride and for the G-force beat (doc 5) to
  show; short enough for a demo.
* **Wind-down 20 s.** A ramp rather than an instant cut avoids a sudden torque step on
  the arms before the brakes bring the rig to rest (a couple of seconds, doc 3 §3.5).

Total programme time before braking: **95 s**.

## 6.4 Lifecycle interaction

Auto mode is explicit state (`Inactive`, `SpinUp`, `Cruise`, `WindDown`, `Braking`)
orthogonal to the ride lifecycle (`RideState`). It is *active* from a successful start
until the ride is at rest:

* **Start** is accepted only from `Safe`; it performs `Safe → Started` and arms `SpinUp`.
* **Stop** is accepted only in a *driving* phase (`SpinUp`/`Cruise`/`WindDown`); it
  performs `Started → Stopping` and moves to `Braking`.
* **Completion** performs the same `Started → Stopping` hand-off and moves to `Braking`.
* The state clears when the ride settles into `Offloading` and immediately on
  Emergency Stop.
* While active, the server rejects every manual power, direction, engine-brake and
  gondola-brake command and any operator request for `Started` or `Stopping`.
  Emergency Stop is always accepted.
