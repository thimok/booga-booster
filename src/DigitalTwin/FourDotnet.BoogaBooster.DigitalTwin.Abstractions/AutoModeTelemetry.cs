namespace FourDotnet.BoogaBooster.DigitalTwin.Abstractions;

/// <summary>
/// The auto programme's status as carried in <see cref="RideTelemetry"/>. A client
/// derives its auto-mode controls purely from this record.
/// </summary>
/// <param name="IsActive">
/// <c>true</c> from a successful start of auto mode until the ride has come to rest (or
/// an Emergency Stop). While <c>true</c> the server rejects manual power, direction and
/// brake commands and operator requests for <see cref="RideState.Started"/> /
/// <see cref="RideState.Stopping"/>.
/// </param>
/// <param name="Phase">The programme phase; <see cref="AutoModeState.Inactive"/> when not active.</param>
/// <param name="CanStart"><c>true</c> when a start-auto request is legal right now (ride Safe, no programme running).</param>
/// <param name="CanStop"><c>true</c> when a stop-auto request is legal right now (programme still driving the motors).</param>
public sealed record AutoModeTelemetry(
    bool IsActive,
    AutoModeState Phase,
    bool CanStart,
    bool CanStop);
