using FourDotnet.BoogaBooster.Core.Cqrs;

namespace FourDotnet.BoogaBooster.DigitalTwin.Features.StartAutoMode;

/// <summary>Starts the predefined auto programme; legal only while the ride is Safe.</summary>
public sealed record StartAutoModeCommand : Command;
