# Spec Delta

## ADDED Requirements

### Requirement: Effects controls group

The dashboard SHALL include an Effects controls group in the left control rail, below the operation controls, offering the smoke, water spray and stroboscope controls defined by the `ride-visual-effects` capability. The group SHALL be a labelled region so assistive technology can navigate to it.

#### Scenario: Effects group visible

- **WHEN** the dashboard is displayed
- **THEN** an Effects group with smoke, water spray and stroboscope controls appears in the left rail

#### Scenario: Group is a landmark

- **WHEN** the dashboard is audited with axe-core
- **THEN** the Effects group is exposed as a labelled region and no violations are reported
