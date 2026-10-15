import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RideTelemetryDto } from '../models/ride.models';
import { RideLifecycleService } from './ride-lifecycle.service';

const TELEMETRY_URL = '/api/ride/telemetry';
const STATE_URL = '/api/ride/state';
const AUTO_START_URL = '/api/ride/auto/start';
const AUTO_STOP_URL = '/api/ride/auto/stop';

const POLL_MS = 1000;

describe('RideLifecycleService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('projects the polled telemetry onto state and availableTransitions signals', () => {
    const service = TestBed.inject(RideLifecycleService);

    const dto: RideTelemetryDto = {
      state: 'Started',
      availableTransitions: ['Stopping', 'EmergencyStop'],
    };
    http.expectOne(TELEMETRY_URL).flush(dto);

    expect(service.state()).toBe('started');
    expect(service.availableTransitions()).toEqual(['stopping', 'emergency-stop']);
  });

  it('maps numeric enum indices for state and availableTransitions', () => {
    const service = TestBed.inject(RideLifecycleService);

    const dto: RideTelemetryDto = {
      state: 2, // Safe
      availableTransitions: [3, 1, 6], // Started, Loading, EmergencyStop
    };
    http.expectOne(TELEMETRY_URL).flush(dto);

    expect(service.state()).toBe('safe');
    expect(service.availableTransitions()).toEqual(['started', 'loading', 'emergency-stop']);
  });

  it('seeds state as idle and availableTransitions as empty before the first response', () => {
    const service = TestBed.inject(RideLifecycleService);

    expect(service.state()).toBe('idle');
    expect(service.availableTransitions()).toEqual([]);

    http.expectOne(TELEMETRY_URL).flush({ state: 'Idle', availableTransitions: [] });
  });

  it('re-polls the telemetry endpoint on the polling interval', () => {
    TestBed.inject(RideLifecycleService);
    http.expectOne(TELEMETRY_URL).flush({ state: 'Idle', availableTransitions: ['Loading'] });

    vi.advanceTimersByTime(POLL_MS);
    http.expectOne(TELEMETRY_URL).flush({ state: 'Loading', availableTransitions: ['Safe'] });
  });

  it('requestTransition posts the mapped PascalCase state name and then refreshes', () => {
    const service = TestBed.inject(RideLifecycleService);
    http.expectOne(TELEMETRY_URL).flush({ state: 'Safe', availableTransitions: ['Started'] }); // init

    service.requestTransition('started');

    const postReq = http.expectOne(STATE_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ state: 'Started' });
    postReq.flush({});

    // requestTransition triggers an immediate refresh after the POST resolves.
    http
      .expectOne(TELEMETRY_URL)
      .flush({ state: 'Started', availableTransitions: ['Stopping', 'EmergencyStop'] });
    expect(service.state()).toBe('started');
  });

  it('tolerates a failed (illegal) transition POST without throwing, and still refreshes', () => {
    const service = TestBed.inject(RideLifecycleService);
    http.expectOne(TELEMETRY_URL).flush({ state: 'Idle', availableTransitions: ['Loading'] }); // init

    expect(() => service.requestTransition('started')).not.toThrow();

    const postReq = http.expectOne(STATE_URL);
    postReq.error(new ProgressEvent('error'), { status: 400 });

    // The next refresh simply reflects the ride's real, unchanged state.
    http.expectOne(TELEMETRY_URL).flush({ state: 'Idle', availableTransitions: ['Loading'] });
    expect(service.state()).toBe('idle');
  });

  it('defaults autoMode to inactive when the telemetry carries none', () => {
    const service = TestBed.inject(RideLifecycleService);
    http.expectOne(TELEMETRY_URL).flush({ state: 'Idle', availableTransitions: [] });

    expect(service.autoMode().isActive).toBe(false);
    expect(service.autoMode().phase).toBe('inactive');
  });

  it('projects the polled autoMode onto the autoMode signal', () => {
    const service = TestBed.inject(RideLifecycleService);
    http.expectOne(TELEMETRY_URL).flush({
      state: 'Started',
      availableTransitions: ['EmergencyStop'],
      autoMode: { isActive: true, phase: 2, canStart: false, canStop: true },
    });

    expect(service.autoMode()).toEqual({
      isActive: true,
      phase: 'cruise',
      canStart: false,
      canStop: true,
    });
  });

  it('startAuto posts to the start endpoint without a body and then refreshes', () => {
    const service = TestBed.inject(RideLifecycleService);
    http.expectOne(TELEMETRY_URL).flush({ state: 'Safe', availableTransitions: [] });

    service.startAuto();

    const postReq = http.expectOne(AUTO_START_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toBeNull();
    postReq.flush(null, { status: 202, statusText: 'Accepted' });

    http.expectOne(TELEMETRY_URL).flush({
      state: 'Started',
      availableTransitions: ['EmergencyStop'],
      autoMode: { isActive: true, phase: 'SpinUp', canStart: false, canStop: true },
    });
    expect(service.autoMode().isActive).toBe(true);
    expect(service.autoMode().phase).toBe('spin-up');
  });

  it('stopAuto posts to the stop endpoint and tolerates a rejection', () => {
    const service = TestBed.inject(RideLifecycleService);
    http.expectOne(TELEMETRY_URL).flush({ state: 'Safe', availableTransitions: [] });

    expect(() => service.stopAuto()).not.toThrow();

    const postReq = http.expectOne(AUTO_STOP_URL);
    expect(postReq.request.method).toBe('POST');
    postReq.error(new ProgressEvent('error'), { status: 400 });

    http.expectOne(TELEMETRY_URL).flush({ state: 'Safe', availableTransitions: [] });
    expect(service.autoMode().isActive).toBe(false);
  });
});
