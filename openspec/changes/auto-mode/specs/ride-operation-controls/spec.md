# Spec Delta

## ADDED Requirements

### Requirement: Auto-mode buttons

The operation controls SHALL provide a **Start auto** button and a **Stop auto** button. Start auto SHALL be enabled only when the server reports a start-auto request is legal; Stop auto SHALL be enabled only while auto mode is active. Activating a button SHALL send the corresponding request to the server, and the controls SHALL reflect the status the server then reports.

#### Scenario: Start auto lit when the ride is Safe

- **WHEN** the ride is `Safe` and auto mode is inactive
- **THEN** Start auto is enabled and Stop auto is disabled

#### Scenario: Stop auto lit while auto runs

- **WHEN** auto mode is active
- **THEN** Stop auto is enabled and Start auto is disabled

#### Scenario: Activating Start auto

- **WHEN** the operator activates the enabled Start auto button
- **THEN** a start-auto request is sent to the server and, once confirmed, the controls show auto mode active

#### Scenario: Both disabled otherwise

- **WHEN** the ride is `Idle`
- **THEN** both Start auto and Stop auto are disabled

### Requirement: Manual controls disabled during auto mode

While auto mode is active, the mill and hub power sliders, the direction toggles and the brake action SHALL be disabled and SHALL NOT send commands, and the controls SHALL tell the operator that auto mode is in control. The power sliders SHALL display the powers the programme is applying.

#### Scenario: Sliders disabled while auto runs

- **WHEN** auto mode is active
- **THEN** the power sliders, direction toggles and brake action are disabled
- **AND** a visible message states that auto mode is controlling the ride

#### Scenario: Sliders follow the programme

- **WHEN** auto mode ramps the mill power to 40%
- **THEN** the mill power slider displays 40%

#### Scenario: Manual controls return after auto

- **WHEN** auto mode has ended
- **THEN** the manual controls follow the normal rules for the current lifecycle state

### Requirement: Accessible auto-mode controls

The auto-mode buttons SHALL be keyboard operable, expose an accessible name, convey enabled/disabled state by more than colour alone, and pass AXE / WCAG AA checks.

#### Scenario: Disabled state exposed

- **WHEN** assistive technology inspects Stop auto while auto mode is inactive
- **THEN** the button reports as disabled with the accessible name "Stop auto"
