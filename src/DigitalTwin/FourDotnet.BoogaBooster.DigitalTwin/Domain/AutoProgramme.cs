using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;

namespace FourDotnet.BoogaBooster.DigitalTwin.Domain;

/// <summary>
/// The throttle setpoints the auto programme commands at one instant.
/// </summary>
/// <param name="Phase">The programme phase at that instant.</param>
/// <param name="MillPowerPercent">Mill throttle (0–100).</param>
/// <param name="HubPowerPercent">Throttle applied to every hub (0–100).</param>
public readonly record struct AutoSetpoint(AutoModeState Phase, double MillPowerPercent, double HubPowerPercent)
{
    /// <summary><c>true</c> while the programme still drives the motors (spin-up, cruise, wind-down).</summary>
    public bool IsDriving => Phase is AutoModeState.SpinUp or AutoModeState.Cruise or AutoModeState.WindDown;
}

/// <summary>
/// The predefined auto ride programme — a pure function of elapsed simulation time
/// (see <c>docs/06-auto-programme.md</c>). Linear ramps up and down around a constant
/// cruise plateau; no randomness and no clock, so identical inputs always yield
/// identical setpoints. Allocation-free: the setpoint is a small readonly struct.
/// </summary>
public static class AutoProgramme
{
    private const double CruiseStartSeconds = RideParameters.AutoSpinUpSeconds;
    private const double WindDownStartSeconds = CruiseStartSeconds + RideParameters.AutoCruiseSeconds;

    /// <summary>Total length of the driven part of the programme (s); braking starts here.</summary>
    public const double DrivenDurationSeconds = WindDownStartSeconds + RideParameters.AutoWindDownSeconds;

    /// <summary>The setpoints at <paramref name="elapsedSeconds"/> since auto mode started.</summary>
    /// <remarks>Each phase boundary belongs to the later phase, so the output is continuous across it.</remarks>
    public static AutoSetpoint Evaluate(double elapsedSeconds)
    {
        if (double.IsNaN(elapsedSeconds) || elapsedSeconds < 0d)
        {
            throw new ArgumentOutOfRangeException(nameof(elapsedSeconds), elapsedSeconds, "Elapsed time must be a non-negative number.");
        }

        if (elapsedSeconds < CruiseStartSeconds)
        {
            return AtFraction(AutoModeState.SpinUp, elapsedSeconds / RideParameters.AutoSpinUpSeconds);
        }

        if (elapsedSeconds < WindDownStartSeconds)
        {
            return AtFraction(AutoModeState.Cruise, 1d);
        }

        if (elapsedSeconds < DrivenDurationSeconds)
        {
            var remaining = 1d - ((elapsedSeconds - WindDownStartSeconds) / RideParameters.AutoWindDownSeconds);
            return AtFraction(AutoModeState.WindDown, remaining);
        }

        return new AutoSetpoint(AutoModeState.Braking, 0d, 0d);
    }

    private static AutoSetpoint AtFraction(AutoModeState phase, double fractionOfPeak)
    {
        var fraction = Math.Clamp(fractionOfPeak, 0d, 1d);
        return new AutoSetpoint(
            phase,
            RideParameters.AutoMillPeakPowerPercent * fraction,
            RideParameters.AutoHubPeakPowerPercent * fraction);
    }
}
