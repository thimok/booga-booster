# Spec Delta

## Purpose

Defines the smoke, water-spray and stroboscope effects shown in the 3D ride visualization, the operator controls that switch them on and tune them, how weather affects them, and the safeguards that keep the strobe photosensitivity-safe.

## ADDED Requirements

### Requirement: Effects are presentational only

Visual effects SHALL NOT change ride physics, telemetry, ride state or any server data. Enabling, disabling or tuning an effect SHALL have no observable effect on the simulation.

#### Scenario: Effects do not affect the ride

- **WHEN** the operator enables smoke, water spray and the strobe while the ride is running
- **THEN** no command is sent to the server and the telemetry shown is unchanged

#### Scenario: Effects available in every ride state

- **WHEN** the ride is in any lifecycle state, including `Safe`
- **THEN** the effects controls are enabled and the effects render when switched on

### Requirement: Effect toggles and intensity

The operator SHALL be able to switch smoke, water spray and the stroboscope on or off independently, and to set an intensity for each from 0% to 100%. Smoke, water spray and the stroboscope SHALL all be off by default. Intensity values outside 0–100 SHALL be clamped.

#### Scenario: Effects start disabled

- **WHEN** the dashboard loads
- **THEN** smoke, water spray and the stroboscope are all off

#### Scenario: Operator enables smoke

- **WHEN** the operator switches smoke on
- **THEN** smoke plumes are rendered around the base of the ride
- **AND** the smoke toggle is reported as on to assistive technology

#### Scenario: Intensity scales the effect

- **WHEN** the operator raises the water-spray intensity from 30% to 80%
- **THEN** the spray visibly becomes denser than before

#### Scenario: Intensity clamped

- **WHEN** an intensity below 0 or above 100 is requested
- **THEN** it is clamped to the 0–100 range

### Requirement: Smoke drifts with the wind

Smoke SHALL rise from the base of the ride and drift downwind with a strength that grows with the current wind (Beaufort) reported by the weather panel. With no weather data available, smoke SHALL rise without drift.

#### Scenario: Smoke blown by wind

- **WHEN** smoke is on and the wind is strong
- **THEN** the plumes lean noticeably downwind compared with calm conditions

#### Scenario: No weather data

- **WHEN** smoke is on and no weather conditions are available
- **THEN** the smoke rises vertically

### Requirement: Water spray is suppressed in unsuitable weather

Water spray SHALL be rendered as falling droplets sprayed from the base ring of the ride. While the temperature is at or below freezing, or the weather regime is strong wind, spray SHALL NOT be rendered even if switched on, and the control SHALL tell the operator why.

#### Scenario: Spray in mild weather

- **WHEN** water spray is on and the temperature is above 0 °C in a non-strong-wind regime
- **THEN** spray droplets are rendered

#### Scenario: Spray suppressed when freezing

- **WHEN** water spray is on and the temperature is 0 °C or below
- **THEN** no spray is rendered
- **AND** the control shows that spray is unavailable because of freezing temperatures

#### Scenario: Spray suppressed in strong wind

- **WHEN** water spray is on and the weather regime is strong wind
- **THEN** no spray is rendered
- **AND** the control shows that spray is unavailable because of strong wind

### Requirement: Stroboscope is photosensitivity-safe

The stroboscope SHALL flash the scene at a rate that never exceeds 3 flashes per second at any intensity. It SHALL be off by default and never restored to on after a reload, and switching it on SHALL require an explicit toggle accompanied by a visible photosensitivity warning. The stroboscope SHALL NOT render, and its toggle SHALL be unavailable, when the user's system prefers reduced motion. Intensity SHALL scale flash brightness and cadence only within the 3-flashes-per-second limit.

#### Scenario: Flash rate capped

- **WHEN** the stroboscope is on at 100% intensity
- **THEN** the scene flashes no more than 3 times in any one-second window

#### Scenario: Warning shown

- **WHEN** the effects controls are displayed
- **THEN** a photosensitivity warning is visible next to the stroboscope toggle

#### Scenario: Reduced motion

- **WHEN** the user prefers reduced motion
- **THEN** the stroboscope does not flash and its toggle is disabled with an explanation

#### Scenario: Strobe stops when switched off

- **WHEN** the operator switches the stroboscope off
- **THEN** flashing stops immediately and the scene lighting returns to normal

### Requirement: Effects controls are accessible

The effects controls SHALL be operable by keyboard, SHALL expose a programmatic name and state for every toggle and slider, and SHALL pass AXE / WCAG AA checks.

#### Scenario: Keyboard operation

- **WHEN** the operator tabs to the smoke toggle and presses Space
- **THEN** smoke switches on or off

#### Scenario: Accessibility audit

- **WHEN** the effects controls are audited with axe-core
- **THEN** no violations are reported
