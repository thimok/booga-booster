using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;
using FourDotnet.BoogaBooster.DigitalTwin.Domain;
using Xunit;

namespace FourDotnet.BoogaBooster.DigitalTwin.Tests;

/// <summary>The auto programme as a pure function of elapsed time: ramps, cruise hold, boundaries, determinism.</summary>
public sealed class AutoProgrammeTests
{
    private const double CruiseStart = RideParameters.AutoSpinUpSeconds;
    private const double WindDownStart = CruiseStart + RideParameters.AutoCruiseSeconds;
    private const double End = WindDownStart + RideParameters.AutoWindDownSeconds;

    [Fact]
    public void The_programme_starts_in_spin_up_at_zero_power()
    {
        var setpoint = AutoProgramme.Evaluate(0d);

        Assert.Equal(AutoModeState.SpinUp, setpoint.Phase);
        Assert.Equal(0d, setpoint.MillPowerPercent);
        Assert.Equal(0d, setpoint.HubPowerPercent);
        Assert.True(setpoint.IsDriving);
    }

    [Fact]
    public void Spin_up_ramps_power_monotonically_towards_the_peaks()
    {
        var previous = AutoProgramme.Evaluate(0d);
        for (var t = 0.25d; t < CruiseStart; t += 0.25d)
        {
            var current = AutoProgramme.Evaluate(t);

            Assert.Equal(AutoModeState.SpinUp, current.Phase);
            Assert.True(current.MillPowerPercent > previous.MillPowerPercent);
            Assert.True(current.HubPowerPercent > previous.HubPowerPercent);
            Assert.True(current.MillPowerPercent < RideParameters.AutoMillPeakPowerPercent);
            previous = current;
        }
    }

    [Fact]
    public void Spin_up_is_linear_so_halfway_is_half_of_the_peak()
    {
        var setpoint = AutoProgramme.Evaluate(RideParameters.AutoSpinUpSeconds / 2d);

        Assert.Equal(RideParameters.AutoMillPeakPowerPercent / 2d, setpoint.MillPowerPercent, precision: 9);
        Assert.Equal(RideParameters.AutoHubPeakPowerPercent / 2d, setpoint.HubPowerPercent, precision: 9);
    }

    [Theory]
    [InlineData(CruiseStart)]
    [InlineData(CruiseStart + 1d)]
    [InlineData((CruiseStart + WindDownStart) / 2d)]
    [InlineData(WindDownStart - 0.001d)]
    public void Cruise_holds_the_peak_setpoints_for_the_whole_phase(double elapsed)
    {
        var setpoint = AutoProgramme.Evaluate(elapsed);

        Assert.Equal(AutoModeState.Cruise, setpoint.Phase);
        Assert.Equal(RideParameters.AutoMillPeakPowerPercent, setpoint.MillPowerPercent);
        Assert.Equal(RideParameters.AutoHubPeakPowerPercent, setpoint.HubPowerPercent);
    }

    [Fact]
    public void Wind_down_ramps_power_monotonically_back_towards_zero()
    {
        var previous = AutoProgramme.Evaluate(WindDownStart);
        Assert.Equal(AutoModeState.WindDown, previous.Phase);
        Assert.Equal(RideParameters.AutoMillPeakPowerPercent, previous.MillPowerPercent);

        for (var t = WindDownStart + 0.25d; t < End; t += 0.25d)
        {
            var current = AutoProgramme.Evaluate(t);

            Assert.Equal(AutoModeState.WindDown, current.Phase);
            Assert.True(current.MillPowerPercent < previous.MillPowerPercent);
            Assert.True(current.HubPowerPercent < previous.HubPowerPercent);
            Assert.True(current.MillPowerPercent > 0d);
            previous = current;
        }
    }

    [Theory]
    [InlineData(CruiseStart, AutoModeState.Cruise)]
    [InlineData(WindDownStart, AutoModeState.WindDown)]
    [InlineData(End, AutoModeState.Braking)]
    [InlineData(End + 1000d, AutoModeState.Braking)]
    public void A_phase_boundary_belongs_to_the_later_phase(double elapsed, AutoModeState expected)
    {
        Assert.Equal(expected, AutoProgramme.Evaluate(elapsed).Phase);
    }

    [Fact]
    public void The_programme_is_continuous_across_the_ramp_boundaries()
    {
        const double epsilon = 1e-6d;

        Assert.Equal(
            AutoProgramme.Evaluate(CruiseStart).MillPowerPercent,
            AutoProgramme.Evaluate(CruiseStart - epsilon).MillPowerPercent,
            precision: 3);
        Assert.Equal(
            AutoProgramme.Evaluate(WindDownStart).MillPowerPercent,
            AutoProgramme.Evaluate(WindDownStart - epsilon).MillPowerPercent,
            precision: 3);
        Assert.Equal(0d, AutoProgramme.Evaluate(End - epsilon).MillPowerPercent, precision: 3);
    }

    [Fact]
    public void Braking_commands_no_power_and_is_not_driving()
    {
        var setpoint = AutoProgramme.Evaluate(End);

        Assert.Equal(0d, setpoint.MillPowerPercent);
        Assert.Equal(0d, setpoint.HubPowerPercent);
        Assert.False(setpoint.IsDriving);
    }

    [Fact]
    public void Every_setpoint_is_a_valid_engine_power()
    {
        for (var t = 0d; t <= End + 1d; t += 0.01d)
        {
            var setpoint = AutoProgramme.Evaluate(t);

            _ = new EnginePower(setpoint.MillPowerPercent);
            _ = new EnginePower(setpoint.HubPowerPercent);
        }
    }

    [Fact]
    public void The_programme_is_deterministic()
    {
        for (var t = 0d; t <= End + 1d; t += 0.37d)
        {
            Assert.Equal(AutoProgramme.Evaluate(t), AutoProgramme.Evaluate(t));
        }
    }

    [Fact]
    public void The_driven_duration_is_the_sum_of_the_three_phases()
    {
        Assert.Equal(End, AutoProgramme.DrivenDurationSeconds);
    }

    [Theory]
    [InlineData(-0.001d)]
    [InlineData(double.NaN)]
    public void An_invalid_elapsed_time_is_rejected(double elapsed)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => AutoProgramme.Evaluate(elapsed));
    }

    /// <summary>Guards the documented values in docs/06-auto-programme.md and the appendix against drift.</summary>
    [Fact]
    public void The_documented_constants_match_the_parameters()
    {
        Assert.Equal(30d, RideParameters.AutoSpinUpSeconds);
        Assert.Equal(45d, RideParameters.AutoCruiseSeconds);
        Assert.Equal(20d, RideParameters.AutoWindDownSeconds);
        Assert.Equal(40d, RideParameters.AutoMillPeakPowerPercent);
        Assert.Equal(40d, RideParameters.AutoHubPeakPowerPercent);
        Assert.Equal(15d, RideParameters.MillWarnRpm);
        Assert.Equal(26d, RideParameters.HubWarnRpm);
    }
}
