using FourDotnet.BoogaBooster.Core;
using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;
using FourDotnet.BoogaBooster.DigitalTwin.Domain;
using Xunit;

namespace FourDotnet.BoogaBooster.DigitalTwin.Tests;

/// <summary>Builds rides in known states for the auto-mode tests.</summary>
internal static class AutoModeRides
{
    /// <summary>The longest any test lets a ride run before giving up (s) — far beyond a full run.</summary>
    public const double RunLimitSeconds = 600d;

    /// <summary>A ride in <see cref="RideState.Safe"/>: empty, or with every seat filled and restraints secured.</summary>
    public static Ride SafeRide(bool loaded = false)
    {
        var ride = Ride.Create();
        if (loaded)
        {
            RideSafetyTests.FillEverySeat(ride, kilograms: RideParameters.DefaultPassengerKg);
            RideSafetyTests.Advance(ride, seconds: 1d);
        }
        else
        {
            ride.RequestTransition(RideState.Loading);
        }

        ride.RequestTransition(RideState.Safe);
        return ride;
    }

    /// <summary>Advances <paramref name="ride"/> by whole fixed steps covering <paramref name="seconds"/>.</summary>
    public static void Run(Ride ride, double seconds) => RideSafetyTests.Advance(ride, seconds);

    /// <summary>Advances until <paramref name="done"/> is true (or the run limit); returns the elapsed steps.</summary>
    public static int RunUntil(Ride ride, Func<Ride, bool> done)
    {
        var limit = (int)(RunLimitSeconds / TestHelpers.Dt.TotalSeconds);
        var steps = 0;
        while (!done(ride) && steps < limit)
        {
            ride.Advance(TestHelpers.Dt);
            steps++;
        }

        Assert.True(done(ride), "The ride did not reach the expected condition within the run limit.");
        return steps;
    }
}

/// <summary>The ride aggregate's auto mode: start, advance, hand-off, stop and clearing.</summary>
public sealed class RideAutoModeTests
{
    private static readonly double SpinUpMidpoint = RideParameters.AutoSpinUpSeconds / 2d;
    private static readonly double CruiseMidpoint =
        RideParameters.AutoSpinUpSeconds + (RideParameters.AutoCruiseSeconds / 2d);

    [Fact]
    public void A_new_ride_has_auto_mode_inactive()
    {
        var ride = Ride.Create();

        Assert.Equal(AutoModeState.Inactive, ride.AutoState);
        Assert.False(ride.IsAutoActive);
        Assert.False(ride.CanStartAutoMode);
        Assert.False(ride.CanStopAutoMode);
    }

    [Fact]
    public void Auto_starts_from_safe_and_enters_the_first_phase()
    {
        var ride = AutoModeRides.SafeRide();
        Assert.True(ride.CanStartAutoMode);

        ride.StartAutoMode();

        Assert.Equal(RideState.Started, ride.CurrentState);
        Assert.Equal(AutoModeState.SpinUp, ride.AutoState);
        Assert.True(ride.IsAutoActive);
        Assert.True(ride.CanStopAutoMode);
        Assert.False(ride.CanStartAutoMode);
        Assert.False(ride.Mill.BrakesEngaged);
    }

    [Theory]
    [InlineData(RideState.Idle)]
    [InlineData(RideState.Loading)]
    public void Auto_is_refused_when_the_ride_is_not_safe(RideState state)
    {
        var ride = Ride.Create();
        if (state == RideState.Loading)
        {
            ride.RequestTransition(RideState.Loading);
        }

        var exception = Assert.Throws<DomainValidationException>(ride.StartAutoMode);

        Assert.Contains("Safe", exception.Message);
        Assert.Equal(state, ride.CurrentState);
        Assert.Equal(AutoModeState.Inactive, ride.AutoState);
    }

    [Fact]
    public void Auto_is_refused_while_already_running()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();

        Assert.Throws<DomainValidationException>(ride.StartAutoMode);

        Assert.Equal(AutoModeState.SpinUp, ride.AutoState);
    }

    [Fact]
    public void Spin_up_raises_mill_and_hub_power_without_operator_input()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();

        var previousMill = ride.Mill.Power.Percent;
        var previousHub = ride.Mill.Hubs[0].Power.Percent;
        for (var step = 0; step < 120 * (int)RideParameters.AutoSpinUpSeconds; step += 120)
        {
            AutoModeRides.Run(ride, seconds: 1d);

            Assert.Equal(AutoModeState.SpinUp, ride.AutoState);
            Assert.True(ride.Mill.Power.Percent > previousMill);
            Assert.True(ride.Mill.Hubs[0].Power.Percent > previousHub);
            previousMill = ride.Mill.Power.Percent;
            previousHub = ride.Mill.Hubs[0].Power.Percent;
        }
    }

    [Fact]
    public void Halfway_through_spin_up_power_is_half_of_the_peak()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();

        AutoModeRides.Run(ride, SpinUpMidpoint);

        Assert.Equal(RideParameters.AutoMillPeakPowerPercent / 2d, ride.Mill.Power.Percent, precision: 1);
        Assert.Equal(RideParameters.AutoHubPeakPowerPercent / 2d, ride.Mill.Hubs[0].Power.Percent, precision: 1);
    }

    [Fact]
    public void Cruise_holds_the_peak_power_on_the_mill_and_every_hub()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();

        AutoModeRides.Run(ride, CruiseMidpoint);

        Assert.Equal(AutoModeState.Cruise, ride.AutoState);
        Assert.Equal(RideParameters.AutoMillPeakPowerPercent, ride.Mill.Power.Percent);
        foreach (var hub in ride.Mill.Hubs)
        {
            Assert.Equal(RideParameters.AutoHubPeakPowerPercent, hub.Power.Percent);
        }
    }

    [Fact]
    public void Wind_down_ramps_power_back_down()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        AutoModeRides.Run(ride, RideParameters.AutoSpinUpSeconds + RideParameters.AutoCruiseSeconds + 1d);
        var early = ride.Mill.Power.Percent;

        AutoModeRides.Run(ride, seconds: 5d);

        Assert.Equal(AutoModeState.WindDown, ride.AutoState);
        Assert.True(ride.Mill.Power.Percent < early);
        Assert.True(ride.Mill.Power.Percent > 0d);
    }

    [Fact]
    public void The_programme_hands_off_to_a_controlled_stop_when_it_finishes()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();

        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Stopping);

        Assert.Equal(AutoModeState.Braking, ride.AutoState);
        Assert.True(ride.IsAutoActive);
        Assert.False(ride.CanStopAutoMode);
        Assert.True(ride.Mill.BrakesEngaged);
        Assert.Equal(0d, ride.Mill.Power.Percent);
        Assert.Equal(0d, ride.Mill.Hubs[0].Power.Percent);
        Assert.True(ride.SimulationTimeSeconds >= AutoProgramme.DrivenDurationSeconds);
    }

    [Fact]
    public void After_completion_the_ride_comes_to_rest_offloads_and_auto_ends()
    {
        var ride = AutoModeRides.SafeRide(loaded: true);
        ride.StartAutoMode();

        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Offloading);

        Assert.Equal(AutoModeState.Inactive, ride.AutoState);
        Assert.False(ride.ConstraintsLocked);

        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Idle);

        Assert.False(ride.IsAutoActive);
        Assert.Equal(0, ride.Mill.BoardedPassengerCount);
    }

    [Fact]
    public void Stopping_during_cruise_cuts_power_and_applies_the_brakes()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        AutoModeRides.Run(ride, CruiseMidpoint);

        ride.StopAutoMode();

        Assert.Equal(RideState.Stopping, ride.CurrentState);
        Assert.Equal(AutoModeState.Braking, ride.AutoState);
        Assert.False(ride.CanStopAutoMode);
        Assert.True(ride.Mill.BrakesEngaged);
        Assert.Equal(0d, ride.Mill.Power.Percent);
        Assert.Equal(0d, ride.Mill.Hubs[0].Power.Percent);
    }

    [Fact]
    public void A_stopped_ride_comes_to_rest_and_offloads_without_resuming_the_programme()
    {
        var ride = AutoModeRides.SafeRide(loaded: true);
        ride.StartAutoMode();
        AutoModeRides.Run(ride, CruiseMidpoint);
        ride.StopAutoMode();

        AutoModeRides.Run(ride, seconds: 1d);
        Assert.Equal(0d, ride.Mill.Power.Percent);

        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Offloading);
        Assert.False(ride.IsAutoActive);

        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Idle);
    }

    [Fact]
    public void Stopping_is_refused_when_auto_is_not_active()
    {
        var ride = AutoModeRides.SafeRide();

        var exception = Assert.Throws<DomainValidationException>(ride.StopAutoMode);

        Assert.Contains("not active", exception.Message);
        Assert.Equal(RideState.Safe, ride.CurrentState);
    }

    [Fact]
    public void Stopping_is_refused_once_the_programme_is_already_braking()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        ride.StopAutoMode();

        var exception = Assert.Throws<DomainValidationException>(ride.StopAutoMode);

        Assert.Contains("braking", exception.Message);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Emergency_stop_overrides_auto_and_ends_it_immediately(bool duringBraking)
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        AutoModeRides.Run(ride, CruiseMidpoint);
        if (duringBraking)
        {
            ride.StopAutoMode();
        }

        ride.RequestTransition(RideState.EmergencyStop);

        Assert.Equal(RideState.EmergencyStop, ride.CurrentState);
        Assert.Equal(AutoModeState.Inactive, ride.AutoState);
        Assert.True(ride.Mill.BrakesEngaged);
        Assert.Equal(0d, ride.Mill.Power.Percent);
    }

    [Fact]
    public void After_an_emergency_stop_the_programme_never_resumes()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        AutoModeRides.Run(ride, CruiseMidpoint);
        ride.RequestTransition(RideState.EmergencyStop);

        AutoModeRides.Run(ride, seconds: 5d);

        Assert.Equal(0d, ride.Mill.Power.Percent);
        Assert.Equal(AutoModeState.Inactive, ride.AutoState);
    }

    [Fact]
    public void A_second_auto_run_can_follow_the_first()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Idle);

        ride.RequestTransition(RideState.Loading);
        ride.RequestTransition(RideState.Safe);
        ride.StartAutoMode();

        Assert.Equal(AutoModeState.SpinUp, ride.AutoState);
        AutoModeRides.Run(ride, seconds: 1d);
        Assert.True(ride.Mill.Power.Percent < RideParameters.AutoMillPeakPowerPercent);
    }

    [Fact]
    public void Identical_rides_produce_identical_runs_step_for_step()
    {
        var first = AutoModeRides.SafeRide(loaded: true);
        var second = AutoModeRides.SafeRide(loaded: true);
        first.StartAutoMode();
        second.StartAutoMode();

        var steps = (int)((AutoProgramme.DrivenDurationSeconds + 5d) / TestHelpers.Dt.TotalSeconds);
        for (var i = 0; i < steps; i++)
        {
            first.Advance(TestHelpers.Dt);
            second.Advance(TestHelpers.Dt);

            Assert.Equal(first.AutoState, second.AutoState);
            Assert.Equal(first.CurrentState, second.CurrentState);
            Assert.Equal(first.Mill.Power.Percent, second.Mill.Power.Percent);
            Assert.Equal(first.Mill.AngularVelocity, second.Mill.AngularVelocity);
        }
    }
}
