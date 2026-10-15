using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;
using FourDotnet.BoogaBooster.DigitalTwin.Domain;
using Xunit;

namespace FourDotnet.BoogaBooster.DigitalTwin.Tests;

/// <summary>A complete auto run, start to rest, must stay inside the over-speed warn thresholds.</summary>
public sealed class AutoModeSpeedLimitTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void A_complete_run_never_exceeds_the_warn_speeds_of_the_mill_or_any_hub(bool loaded)
    {
        var ride = AutoModeRides.SafeRide(loaded);
        ride.StartAutoMode();

        var peakMillRpm = 0d;
        var peakHubRpm = 0d;
        var reachedRest = false;
        var limit = (int)(AutoModeRides.RunLimitSeconds / TestHelpers.Dt.TotalSeconds);

        for (var step = 0; step < limit && !reachedRest; step++)
        {
            ride.Advance(TestHelpers.Dt);

            var millRpm = Math.Abs(RotationalDynamics.ToRpm(ride.Mill.AngularVelocity));
            peakMillRpm = Math.Max(peakMillRpm, millRpm);
            Assert.True(
                millRpm < RideParameters.MillWarnRpm,
                $"Mill at {millRpm:0.00} rpm after {ride.SimulationTimeSeconds:0.0} s exceeds the {RideParameters.MillWarnRpm} rpm warn threshold.");

            foreach (var hub in ride.Mill.Hubs)
            {
                var hubRpm = Math.Abs(RotationalDynamics.ToRpm(hub.AngularVelocity));
                peakHubRpm = Math.Max(peakHubRpm, hubRpm);
                Assert.True(
                    hubRpm < RideParameters.HubWarnRpm,
                    $"Hub {hub.Index} at {hubRpm:0.00} rpm after {ride.SimulationTimeSeconds:0.0} s exceeds the {RideParameters.HubWarnRpm} rpm warn threshold.");
            }

            reachedRest = ride.CurrentState is RideState.Offloading or RideState.Idle;
        }

        Assert.True(reachedRest, "The auto run never brought the ride to rest.");
        Assert.False(ride.IsAutoActive);

        // The programme must actually spin the ride up — a vacuous pass at standstill proves nothing.
        Assert.True(peakMillRpm > RideParameters.MillWarnRpm / 2d, $"Peak mill speed {peakMillRpm:0.00} rpm is implausibly low.");
        Assert.True(peakHubRpm > RideParameters.HubWarnRpm / 2d, $"Peak hub speed {peakHubRpm:0.00} rpm is implausibly low.");
    }
}
