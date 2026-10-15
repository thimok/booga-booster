using FourDotnet.BoogaBooster.Core;
using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;
using FourDotnet.BoogaBooster.DigitalTwin.Domain;
using Xunit;

namespace FourDotnet.BoogaBooster.DigitalTwin.Tests;

/// <summary>The manual-control lock: every manual mutator is refused while auto mode owns the ride.</summary>
public sealed class RideAutoModeLockTests
{
    private static readonly string[] OperationNames =
    [
        nameof(Ride.SetMainEnginePower),
        nameof(Ride.SetHubEnginePower),
        nameof(Ride.SetMainEngineDirection),
        nameof(Ride.SetHubEngineDirection),
        nameof(Ride.SetEngineBrakes),
        nameof(Ride.SetGondolaBrake),
    ];

    /// <summary>Every operator command that changes power, direction or brakes, by name.</summary>
    public static TheoryData<string> ManualOperations => [.. OperationNames];

    private static void Invoke(Ride ride, string operation)
    {
        switch (operation)
        {
            case nameof(Ride.SetMainEnginePower):
                ride.SetMainEnginePower(new EnginePower(70d));
                break;
            case nameof(Ride.SetHubEnginePower):
                ride.SetHubEnginePower(new EnginePower(70d));
                break;
            case nameof(Ride.SetMainEngineDirection):
                ride.SetMainEngineDirection(MotorDirection.Reverse);
                break;
            case nameof(Ride.SetHubEngineDirection):
                ride.SetHubEngineDirection(MotorDirection.Reverse);
                break;
            case nameof(Ride.SetEngineBrakes):
                ride.SetEngineBrakes(engaged: true);
                break;
            case nameof(Ride.SetGondolaBrake):
                ride.SetGondolaBrake(0, 0, GondolaBrakeState.Engaged);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(operation), operation, "Unknown manual operation.");
        }
    }

    [Fact]
    public void The_theory_enumerates_every_manual_mutator_on_the_ride()
    {
        var mutators = typeof(Ride)
            .GetMethods(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.DeclaredOnly)
            .Select(method => method.Name)
            .Where(name => name.StartsWith("Set", StringComparison.Ordinal))
            .ToHashSet();

        Assert.Equal(mutators.Order(), OperationNames.Order());
    }

    [Theory]
    [MemberData(nameof(ManualOperations))]
    public void A_manual_operation_is_rejected_while_auto_is_driving(string operation)
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        AutoModeRides.Run(ride, seconds: 40d);
        var powerBefore = ride.Mill.Power.Percent;

        var exception = Assert.Throws<DomainValidationException>(() => Invoke(ride, operation));

        Assert.Contains("auto mode", exception.Message);
        Assert.Equal(AutoModeState.Cruise, ride.AutoState);
        Assert.Equal(powerBefore, ride.Mill.Power.Percent);
        Assert.Equal(MotorDirection.Forward, ride.Mill.Direction);
        Assert.False(ride.Mill.BrakesEngaged);
    }

    [Theory]
    [MemberData(nameof(ManualOperations))]
    public void A_manual_operation_is_rejected_while_auto_is_braking(string operation)
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        ride.StopAutoMode();

        Assert.Throws<DomainValidationException>(() => Invoke(ride, operation));
        Assert.Equal(AutoModeState.Braking, ride.AutoState);
    }

    [Theory]
    [MemberData(nameof(ManualOperations))]
    public void A_manual_operation_is_accepted_again_once_auto_has_ended(string operation)
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        ride.StopAutoMode();
        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Idle);

        var exception = Record.Exception(() => Invoke(ride, operation));

        Assert.Null(exception);
    }

    [Theory]
    [MemberData(nameof(ManualOperations))]
    public void A_manual_operation_is_accepted_after_an_emergency_stop_ends_auto(string operation)
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        ride.RequestTransition(RideState.EmergencyStop);

        Assert.Null(Record.Exception(() => Invoke(ride, operation)));
    }

    [Theory]
    [InlineData(RideState.Started)]
    [InlineData(RideState.Stopping)]
    public void An_operator_transition_to_started_or_stopping_is_rejected_while_auto_is_active(RideState target)
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();

        Assert.Throws<DomainValidationException>(() => ride.RequestTransition(target));

        Assert.Equal(RideState.Started, ride.CurrentState);
        Assert.Equal(AutoModeState.SpinUp, ride.AutoState);
    }

    [Fact]
    public void Available_transitions_drop_started_and_stopping_but_keep_emergency_stop_while_auto_is_active()
    {
        var ride = AutoModeRides.SafeRide();
        Assert.Contains(RideState.Started, ride.AvailableTransitions);

        ride.StartAutoMode();

        Assert.Equal([RideState.EmergencyStop], ride.AvailableTransitions);

        ride.StopAutoMode();

        Assert.Equal([RideState.EmergencyStop], ride.AvailableTransitions);
    }

    [Fact]
    public void Manual_start_and_stop_still_work_when_auto_is_not_involved()
    {
        var ride = AutoModeRides.SafeRide();

        ride.RequestTransition(RideState.Started);
        ride.SetMainEnginePower(new EnginePower(50d));
        ride.RequestTransition(RideState.Stopping);

        Assert.Equal(RideState.Stopping, ride.CurrentState);
        Assert.False(ride.IsAutoActive);
    }

    [Fact]
    public void Boarding_is_unaffected_by_the_lock_after_a_run()
    {
        var ride = AutoModeRides.SafeRide();
        ride.StartAutoMode();
        ride.StopAutoMode();
        AutoModeRides.RunUntil(ride, r => r.CurrentState == RideState.Idle);

        ride.BoardPassenger(0, 0, SeatPosition.Left, Passenger.OfWeight(75d), TimeSpan.Zero);

        Assert.Equal(RideState.Loading, ride.CurrentState);
    }
}
