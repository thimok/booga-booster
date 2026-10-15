namespace FourDotnet.BoogaBooster.DigitalTwin.Abstractions;

/// <summary>
/// Where the auto programme currently is. It is orthogonal to <see cref="RideState"/>:
/// the ride lifecycle says what the ride is doing, this says whether a predefined
/// programme owns the controls and which part of it is running. Auto mode is
/// <em>active</em> in every value except <see cref="Inactive"/>.
/// </summary>
public enum AutoModeState
{
    /// <summary>No programme is running; manual control rules apply.</summary>
    Inactive,

    /// <summary>Mill and hub power ramp up from zero to their peak setpoints.</summary>
    SpinUp,

    /// <summary>Peak power is held for the cruise duration.</summary>
    Cruise,

    /// <summary>Power ramps back down to zero ahead of the brakes.</summary>
    WindDown,

    /// <summary>The programme has ended or was stopped; the ride is braking to rest.</summary>
    Braking
}
