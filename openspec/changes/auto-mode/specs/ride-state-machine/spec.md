# Spec Delta

## ADDED Requirements

### Requirement: Auto mode owns the ride's start and stop

While auto mode is active, the state machine SHALL reject operator requests for `Started` and `Stopping` made through the state endpoint, and the status-summary panel SHALL show those buttons disabled. Emergency Stop SHALL remain a legal operator transition throughout. The auto programme itself SHALL move the ride from `Safe` to `Started` and, at its end or on stop-auto, from `Started` to `Stopping`.

#### Scenario: Manual Stopping rejected during auto

- **WHEN** auto mode is active and the ride is `Started`
- **THEN** a transition request to `Stopping` is rejected with a client error
- **AND** the available transitions in telemetry do not include `Stopping`

#### Scenario: Emergency Stop still offered during auto

- **WHEN** auto mode is active
- **THEN** the available transitions in telemetry include `Emergency Stop`

#### Scenario: Status-summary buttons reflect the lock

- **WHEN** auto mode is active
- **THEN** the `Stopping` button is disabled and the `Emergency Stop` button is enabled
