using FourDotnet.BoogaBooster.Core.Cqrs;

namespace FourDotnet.BoogaBooster.DigitalTwin.Features.StopAutoMode;

/// <summary>Aborts the auto programme and brings the ride to a controlled stop; legal only while auto drives the ride.</summary>
public sealed record StopAutoModeCommand : Command;
