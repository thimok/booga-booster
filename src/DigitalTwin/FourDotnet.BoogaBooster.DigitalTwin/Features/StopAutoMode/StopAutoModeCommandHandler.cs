using System.Diagnostics;
using FourDotnet.BoogaBooster.Core.Cqrs;
using FourDotnet.BoogaBooster.DigitalTwin.Application;
using FourDotnet.BoogaBooster.DigitalTwin.Observability;

namespace FourDotnet.BoogaBooster.DigitalTwin.Features.StopAutoMode;

/// <summary>Stops auto mode through the store; the domain rejects a stop when the programme is not driving the ride.</summary>
public sealed class StopAutoModeCommandHandler : CommandHandler<StopAutoModeCommand>
{
    private readonly IRideStore _store;

    public StopAutoModeCommandHandler(IRideStore store)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
    }

    protected override Task ExecuteAsync(StopAutoModeCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        _store.StopAutoMode();
        return Task.CompletedTask;
    }

    /// <summary>
    /// Records the lifecycle state and auto phase as the ride was found — which phase a
    /// stop interrupted, or why one was refused. Set before the store is called.
    /// </summary>
    protected override void EnrichActivity(Activity activity, StopAutoModeCommand command)
    {
        activity.SetTag(RideTelemetryAttributes.State, _store.CurrentState.ToString());
        activity.SetTag(RideTelemetryAttributes.AutoPhase, _store.AutoState.ToString());
    }
}
