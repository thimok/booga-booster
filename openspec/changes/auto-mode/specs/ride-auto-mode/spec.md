# Spec Delta

## Purpose

Defines the predefined auto programme that flies a complete ride sequence without operator input: how it is started and stopped, what it does to motor power and brakes, how it locks out manual control while it runs, and how its status is reported.

## ADDED Requirements

### Requirement: Auto mode starts only from a safe ride

The system SHALL start auto mode only when the ride is in the `Safe` state. Starting auto mode SHALL move the ride to `Started` and begin the auto programme from its first phase. A start request in any other state SHALL be rejected without changing the ride.

#### Scenario: Auto starts from Safe

- **WHEN** the ride is `Safe` and a start-auto request is made
- **THEN** the ride's state becomes `Started`
- **AND** auto mode is reported active in the first phase of the programme

#### Scenario: Auto refused when the ride is not Safe

- **WHEN** the ride is `Loading` and a start-auto request is made
- **THEN** the request is rejected with a client error
- **AND** the ride's state and auto-mode status are unchanged

#### Scenario: Auto refused while already running

- **WHEN** auto mode is already active and a start-auto request is made
- **THEN** the request is rejected with a client error

### Requirement: Auto programme runs the full ride sequence

While active, auto mode SHALL drive the mill and hub motors and the brakes through, in order: **spin-up** (power ramps from zero to the programme's peak setpoints), **cruise** (peak power held for a fixed duration), **wind-down** (power ramps back to zero) and **brake** (a controlled stop). The programme SHALL be a pure function of elapsed simulation time so that the same starting conditions always produce the same sequence.

#### Scenario: Power ramps up during spin-up

- **WHEN** auto mode is in the spin-up phase
- **THEN** mill and hub power rise monotonically from zero toward their peak setpoints without operator input

#### Scenario: Peak power is held during cruise

- **WHEN** auto mode is in the cruise phase
- **THEN** mill and hub power equal their peak setpoints for the whole phase

#### Scenario: Programme finishes with a controlled stop

- **WHEN** the wind-down phase completes
- **THEN** the ride enters `Stopping`, power is cut and the brakes are applied
- **AND** once the ride is at rest it offloads and returns to `Idle` under the normal lifecycle rules

#### Scenario: Programme is deterministic

- **WHEN** the programme is run twice from identical ride states with the same time steps
- **THEN** both runs produce identical power setpoints and phase transitions at every step

### Requirement: Programme stays within safe rotation speeds

The programme's peak setpoints SHALL keep the mill and every hub below the warn thresholds of the ride's over-speed limits, so a normal auto run never triggers a protective stop.

#### Scenario: Complete run never over-speeds

- **WHEN** the auto programme runs from start to rest on a safely loaded ride
- **THEN** no component's rotation speed exceeds its warn threshold at any step

### Requirement: Operator can stop auto mode

The system SHALL accept a stop-auto request only while auto mode is active. Stopping SHALL abort the remaining programme, cut motor power, apply the brakes and move the ride to `Stopping`, so that it comes to rest, releases the safety constraints and offloads its riders. A stop-auto request when auto mode is not active SHALL be rejected without changing the ride.

#### Scenario: Stop during cruise

- **WHEN** auto mode is in the cruise phase and a stop-auto request is made
- **THEN** the ride's state becomes `Stopping` with power cut and brakes applied
- **AND** auto mode is no longer in a driving phase

#### Scenario: Stopped ride offloads

- **WHEN** a stop-auto request has brought the ride to rest
- **THEN** the safety constraints are released and the ride becomes `Offloading`, then `Idle` once empty

#### Scenario: Stop refused when auto is not running

- **WHEN** auto mode is not active and a stop-auto request is made
- **THEN** the request is rejected with a client error and the ride is unchanged

### Requirement: Manual control is locked while auto mode runs

While auto mode is active, the server SHALL reject manual main/hub power, direction, engine-brake and gondola-brake commands, and manual lifecycle requests for `Started` and `Stopping`, with a client error and no state change. Emergency Stop SHALL remain accepted and SHALL end auto mode. Auto mode is active from a successful start until the ride has come to rest after the programme ends or is stopped.

#### Scenario: Manual power rejected during auto

- **WHEN** auto mode is active and a manual set-mill-power command is received
- **THEN** it is rejected with a client error and the programme's power is unchanged

#### Scenario: Manual lifecycle transition rejected during auto

- **WHEN** auto mode is active and a transition to `Stopping` is requested through the state endpoint
- **THEN** it is rejected with a client error and auto mode continues

#### Scenario: Emergency stop overrides auto

- **WHEN** auto mode is active and an Emergency Stop is requested
- **THEN** the ride enters `Emergency Stop` with power cut and brakes applied
- **AND** auto mode is no longer active

#### Scenario: Manual control returns after auto ends

- **WHEN** the ride has come to rest after an auto run and is `Idle`
- **THEN** auto mode is inactive and manual commands are accepted according to the normal lifecycle rules

### Requirement: Auto-mode status in telemetry

The ride telemetry SHALL report whether auto mode is active, the current programme phase, whether a start-auto request is currently legal and whether a stop-auto request is currently legal.

#### Scenario: Idle telemetry

- **WHEN** telemetry is read while the ride is `Safe` and auto mode has not been started
- **THEN** auto mode is reported inactive, start-auto is reported available and stop-auto is not

#### Scenario: Running telemetry

- **WHEN** telemetry is read during the cruise phase
- **THEN** auto mode is reported active with phase `Cruise`, stop-auto is available and start-auto is not

### Requirement: HTTP endpoints for auto mode

The DigitalTwin module SHALL expose `POST /ride/auto/start` and `POST /ride/auto/stop`, each taking no body. A legal request SHALL succeed; an illegal request SHALL return a client error.

#### Scenario: Start endpoint success

- **WHEN** a client posts to `/ride/auto/start` while the ride is `Safe`
- **THEN** the endpoint responds with success and telemetry reports auto mode active

#### Scenario: Stop endpoint rejected when idle

- **WHEN** a client posts to `/ride/auto/stop` while auto mode is not active
- **THEN** the endpoint responds with a client error
