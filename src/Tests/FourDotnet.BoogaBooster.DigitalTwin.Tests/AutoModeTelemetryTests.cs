using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;
using FourDotnet.BoogaBooster.DigitalTwin.Domain;
using Xunit;

namespace FourDotnet.BoogaBooster.DigitalTwin.Tests;

/// <summary>The auto-mode block of <see cref="RideTelemetry"/> across the ride's states.</summary>
public sealed class AutoModeTelemetryTests
{
    [Fact]
    public void An_idle_ride_reports_auto_mode_unavailable()
    {
        var telemetry = Ride.Create().ToTelemetry().AutoMode;

        Assert.Equal(new AutoModeTelemetry(false, AutoModeState.Inactive, false, false), telemetry);
    }

    [Fact]
    public void A_loading_ride_reports_auto_mode_unavailable()
    {
        var ride = Ride.Create();
        ride.RequestTransition(RideState.Loading);

        var telemetry = ride.ToTelemetry().AutoMode;

        Assert.False(telemetry.IsActive);
        Assert.False(telemetry.CanStart);
        Assert.False(telemetry.CanStop);
    }

    [Fact]
    public void A_safe_ride_reports_start_available_and_stop_not()
    {
        var telemetry = AutoModeRides.SafeRide().ToTelemetry().AutoMode;

        Assert.Equal(new AutoModeTelemetry(false, AutoModeState.Inactive, true, false), telemetry);
    }

    [Fact]
    public void A_ride_running_auto_reports_the_phase_and_stop_available_and_start_not()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        AutoModeRides.Run(ride, RideParameters.AutoSpinUpSeconds + 1d);

        var telemetry = ride.ToTelemetry().AutoMode;

        Assert.Equal(new AutoModeTelemetry(true, AutoModeState.Cruise, false, true), telemetry);
    }

    [Fact]
    public void A_braking_ride_stays_active_with_neither_action_available()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        ride.StopAutoMode();

        var telemetry = ride.ToTelemetry().AutoMode;

        Assert.Equal(new AutoModeTelemetry(true, AutoModeState.Braking, false, false), telemetry);
    }

    [Fact]
    public void An_emergency_stop_clears_the_auto_mode_status()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        ride.RequestTransition(RideState.EmergencyStop);

        var telemetry = ride.ToTelemetry().AutoMode;

        Assert.Equal(new AutoModeTelemetry(false, AutoModeState.Inactive, false, false), telemetry);
    }

    [Fact]
    public void Telemetry_available_transitions_follow_the_auto_lock()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();

        Assert.Equal([RideState.EmergencyStop], ride.ToTelemetry().AvailableTransitions);
    }
}
