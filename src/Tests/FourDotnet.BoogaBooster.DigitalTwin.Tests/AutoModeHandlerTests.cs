using System.Diagnostics;
using FourDotnet.BoogaBooster.Core;
using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;
using FourDotnet.BoogaBooster.DigitalTwin.Application;
using FourDotnet.BoogaBooster.DigitalTwin.Domain;
using FourDotnet.BoogaBooster.DigitalTwin.Features.BrakeEngines;
using FourDotnet.BoogaBooster.DigitalTwin.Features.SetMainEnginePower;
using FourDotnet.BoogaBooster.DigitalTwin.Features.StartAutoMode;
using FourDotnet.BoogaBooster.DigitalTwin.Features.StopAutoMode;
using Xunit;

namespace FourDotnet.BoogaBooster.DigitalTwin.Tests;

/// <summary>The StartAutoMode / StopAutoMode slices: delegation, rejection paths and ADR-0009 span tags.</summary>
public sealed class AutoModeHandlerTests : IDisposable
{
    private const string StateTag = "ride.state";
    private const string AutoPhaseTag = "ride.auto.phase";

    private readonly TelemetryRecorder _telemetry = new();

    public void Dispose() => _telemetry.Dispose();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static RideStore NewStore() => new(new RandomRideEventSampler(seed: 42));

    private static RideStore SafeStore()
    {
        var store = NewStore();
        store.RequestStateTransition(RideState.Loading);
        store.RequestStateTransition(RideState.Safe);
        return store;
    }

    [Fact]
    public void The_handlers_reject_a_null_store()
    {
        Assert.Throws<ArgumentNullException>(() => new StartAutoModeCommandHandler(null!));
        Assert.Throws<ArgumentNullException>(() => new StopAutoModeCommandHandler(null!));
    }

    [Fact]
    public async Task Start_begins_auto_mode_on_a_safe_ride()
    {
        var store = SafeStore();

        await new StartAutoModeCommandHandler(store).HandleAsync(new StartAutoModeCommand(), Ct);

        Assert.Equal(RideState.Started, store.CurrentState);
        Assert.Equal(AutoModeState.SpinUp, store.AutoState);
        Assert.True(store.GetTelemetry().AutoMode.IsActive);
    }

    [Fact]
    public async Task Start_is_rejected_from_a_ride_that_is_not_safe()
    {
        var store = NewStore();
        store.RequestStateTransition(RideState.Loading);

        await Assert.ThrowsAsync<DomainValidationException>(
            () => new StartAutoModeCommandHandler(store).HandleAsync(new StartAutoModeCommand(), Ct));

        Assert.Equal(RideState.Loading, store.CurrentState);
        Assert.Equal(AutoModeState.Inactive, store.AutoState);
    }

    [Fact]
    public async Task Start_is_rejected_while_auto_is_already_running()
    {
        var store = SafeStore();
        store.StartAutoMode();

        await Assert.ThrowsAsync<DomainValidationException>(
            () => new StartAutoModeCommandHandler(store).HandleAsync(new StartAutoModeCommand(), Ct));
    }

    [Fact]
    public async Task Stop_aborts_a_running_programme_and_brakes()
    {
        var store = SafeStore();
        store.StartAutoMode();

        await new StopAutoModeCommandHandler(store).HandleAsync(new StopAutoModeCommand(), Ct);

        var telemetry = store.GetTelemetry();
        Assert.Equal(RideState.Stopping, telemetry.State);
        Assert.Equal(AutoModeState.Braking, telemetry.AutoMode.Phase);
        Assert.True(telemetry.BrakesEngaged);
    }

    [Fact]
    public async Task Stop_is_rejected_when_auto_is_not_active()
    {
        var store = SafeStore();

        await Assert.ThrowsAsync<DomainValidationException>(
            () => new StopAutoModeCommandHandler(store).HandleAsync(new StopAutoModeCommand(), Ct));

        Assert.Equal(RideState.Safe, store.CurrentState);
    }

    [Fact]
    public async Task Manual_commands_are_rejected_through_the_store_while_auto_runs()
    {
        var store = SafeStore();
        store.StartAutoMode();

        await Assert.ThrowsAsync<DomainValidationException>(
            () => new SetMainEnginePowerCommandHandler(store).HandleAsync(new SetMainEnginePowerCommand(90d), Ct));
        await Assert.ThrowsAsync<DomainValidationException>(
            () => new BrakeEnginesCommandHandler(store).HandleAsync(new BrakeEnginesCommand(true), Ct));
        Assert.Throws<DomainValidationException>(() => store.StartRide());
        Assert.Throws<DomainValidationException>(() => store.StopRide());
        Assert.Throws<DomainValidationException>(() => store.RequestStateTransition(RideState.Stopping));
    }

    [Fact]
    public async Task Start_tags_the_state_and_phase_it_found_even_when_refused()
    {
        var store = NewStore();

        using (_telemetry.Scope())
        {
            await Assert.ThrowsAnyAsync<Exception>(
                () => new StartAutoModeCommandHandler(store).HandleAsync(new StartAutoModeCommand(), Ct));
        }

        var activity = _telemetry.Activity("StartAutoMode");
        Assert.Equal(nameof(RideState.Idle), activity.GetTagItem(StateTag));
        Assert.Equal(nameof(AutoModeState.Inactive), activity.GetTagItem(AutoPhaseTag));
        Assert.Equal(ActivityStatusCode.Error, activity.Status);
    }

    [Fact]
    public async Task Stop_tags_the_state_and_phase_it_interrupted()
    {
        var store = SafeStore();
        store.StartAutoMode();

        using (_telemetry.Scope())
        {
            await new StopAutoModeCommandHandler(store).HandleAsync(new StopAutoModeCommand(), Ct);
        }

        var activity = _telemetry.Activity("StopAutoMode");
        Assert.Equal(nameof(RideState.Started), activity.GetTagItem(StateTag));
        Assert.Equal(nameof(AutoModeState.SpinUp), activity.GetTagItem(AutoPhaseTag));
    }

    [Fact]
    public void The_store_exposes_the_auto_phase_as_the_programme_advances()
    {
        var store = SafeStore();
        Assert.Equal(AutoModeState.Inactive, store.AutoState);

        store.StartAutoMode();
        var steps = (int)((RideParameters.AutoSpinUpSeconds + 1d) / RideParameters.TimeStep.TotalSeconds);
        for (var i = 0; i < steps; i++)
        {
            store.Advance(RideParameters.TimeStep);
        }

        Assert.Equal(AutoModeState.Cruise, store.AutoState);
    }
}
