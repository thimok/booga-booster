using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FourDotnet.BoogaBooster.DigitalTwin.Abstractions;
using FourDotnet.BoogaBooster.DigitalTwin.Application;
using FourDotnet.BoogaBooster.DigitalTwin.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace FourDotnet.BoogaBooster.DigitalTwin.Tests;

/// <summary>
/// The auto-mode HTTP surface, exercised over a real loopback Kestrel host so routing,
/// handler dispatch and the 400 translation are all genuinely in play. The simulation
/// loop is removed so the ride only changes when a request changes it.
/// </summary>
public sealed class AutoModeEndpointTests : IAsyncLifetime
{
    private WebApplication _app = null!;
    private HttpClient _client = null!;
    private IRideStore _store = null!;

    public async ValueTask InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.AddDigitalTwinModule();
        foreach (var hosted in builder.Services.Where(d => d.ServiceType == typeof(IHostedService)).ToList())
        {
            builder.Services.Remove(hosted);
        }

        _app = builder.Build();
        _app.MapDigitalTwinEndpoints();
        await _app.StartAsync(TestContext.Current.CancellationToken);

        _store = _app.Services.GetRequiredService<IRideStore>();
        _client = new HttpClient { BaseAddress = new Uri(_app.Urls.First()) };
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _app.DisposeAsync();
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private void MakeSafe()
    {
        _store.RequestStateTransition(RideState.Loading);
        _store.RequestStateTransition(RideState.Safe);
    }

    private Task<HttpResponseMessage> PostAsync(string path) => _client.PostAsync(path, content: null, Ct);

    [Fact]
    public async Task Start_succeeds_on_a_safe_ride_and_telemetry_reports_auto_active()
    {
        MakeSafe();

        using var response = await PostAsync("/ride/auto/start");

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var auto = _store.GetTelemetry().AutoMode;
        Assert.True(auto.IsActive);
        Assert.Equal(AutoModeState.SpinUp, auto.Phase);
    }

    [Fact]
    public async Task Start_is_a_client_error_when_the_ride_is_not_safe()
    {
        _store.RequestStateTransition(RideState.Loading);

        using var response = await PostAsync("/ride/auto/start");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Safe", await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(RideState.Loading, _store.CurrentState);
    }

    [Fact]
    public async Task Start_is_a_client_error_while_auto_is_already_running()
    {
        MakeSafe();
        using var first = await PostAsync("/ride/auto/start");

        using var second = await PostAsync("/ride/auto/start");

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }

    [Fact]
    public async Task Stop_succeeds_while_auto_runs()
    {
        MakeSafe();
        using var start = await PostAsync("/ride/auto/start");

        using var stop = await PostAsync("/ride/auto/stop");

        Assert.Equal(HttpStatusCode.Accepted, stop.StatusCode);
        Assert.Equal(RideState.Stopping, _store.CurrentState);
        Assert.Equal(AutoModeState.Braking, _store.AutoState);
    }

    [Fact]
    public async Task Stop_is_a_client_error_when_auto_is_not_active()
    {
        using var response = await PostAsync("/ride/auto/stop");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(RideState.Idle, _store.CurrentState);
    }

    [Fact]
    public async Task Manual_endpoints_are_a_client_error_while_auto_runs_but_emergency_stop_is_accepted()
    {
        MakeSafe();
        using var start = await PostAsync("/ride/auto/start");

        using var power = await _client.PostAsJsonAsync("/ride/main-power", new { percent = 80 }, Ct);
        using var stopRide = await PostAsync("/ride/stop");
        using var state = await _client.PostAsJsonAsync("/ride/state", new { state = "Stopping" }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, power.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, stopRide.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, state.StatusCode);
        Assert.True(_store.GetTelemetry().AutoMode.IsActive);

        using var emergency = await _client.PostAsJsonAsync("/ride/state", new { state = "EmergencyStop" }, Ct);

        Assert.Equal(HttpStatusCode.Accepted, emergency.StatusCode);
        Assert.False(_store.GetTelemetry().AutoMode.IsActive);
    }

    [Fact]
    public async Task Telemetry_json_carries_the_auto_mode_block_with_camel_case_names()
    {
        MakeSafe();
        using var start = await PostAsync("/ride/auto/start");

        using var response = await _client.GetAsync("/ride/telemetry", Ct);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));

        var auto = document.RootElement.GetProperty("autoMode");
        Assert.True(auto.GetProperty("isActive").GetBoolean());
        Assert.Equal((int)AutoModeState.SpinUp, auto.GetProperty("phase").GetInt32());
        Assert.False(auto.GetProperty("canStart").GetBoolean());
        Assert.True(auto.GetProperty("canStop").GetBoolean());
    }
}
