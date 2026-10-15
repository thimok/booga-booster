using System.Diagnostics;
using FourDotnet.BoogaBooster.Core.Cqrs;
using FourDotnet.BoogaBooster.DigitalTwin.Application;
using FourDotnet.BoogaBooster.DigitalTwin.Observability;

namespace FourDotnet.BoogaBooster.DigitalTwin.Features.StartAutoMode;

/// <summary>Starts auto mode through the store; the domain rejects a start from any state but Safe.</summary>
public sealed class StartAutoModeCommandHandler : CommandHandler<StartAutoModeCommand>
{
    private readonly IRideStore _store;

    public StartAutoModeCommandHandler(IRideStore store)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
    }

    protected override Task ExecuteAsync(StartAutoModeCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        _store.StartAutoMode();
        return Task.CompletedTask;
    }

    /// <summary>
    /// The command carries no payload, so the span records what its outcome depended
    /// on — the lifecycle state and auto phase as the ride was found. The tags are set
    /// before the store is called, so they survive on the span when the start is refused.
    /// </summary>
    protected override void EnrichActivity(Activity activity, StartAutoModeCommand command)
    {
        activity.SetTag(RideTelemetryAttributes.State, _store.CurrentState.ToString());
        activity.SetTag(RideTelemetryAttributes.AutoPhase, _store.AutoState.ToString());
    }
}
