import { TestBed } from '@angular/core/testing';

import { WEATHER_SOURCE } from '../weather/data/weather-source';
import { FakeWeatherSource, createConditions } from '../weather/testing/fake-weather-source';
import { EffectsStateService, INITIAL_EFFECTS_STATE, NO_EFFECTS } from './effects-state.service';

class FakeMediaQueryList extends EventTarget {
  matches: boolean;
  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }
  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(Object.assign(new Event('change'), { matches }));
  }
}

describe('EffectsStateService', () => {
  let weather: FakeWeatherSource;

  function create(reducedMotion = false) {
    const mql = new FakeMediaQueryList(reducedMotion);
    vi.stubGlobal('matchMedia', () => mql);
    weather = new FakeWeatherSource();
    weather.setStatus('ready');
    weather.setConditions(createConditions({ temperatureCelsius: 15 }));
    TestBed.configureTestingModule({ providers: [{ provide: WEATHER_SOURCE, useValue: weather }] });
    return { service: TestBed.inject(EffectsStateService), mql };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('starts with every effect off', () => {
    const { service } = create();

    expect(service.state()).toEqual(INITIAL_EFFECTS_STATE);
    expect(service.levels()).toEqual(NO_EFFECTS);
  });

  it('switches effects on independently and reports their intensity', () => {
    const { service } = create();

    service.setEnabled('smoke', true);
    service.setIntensity('smoke', 80);

    expect(service.smoke()).toEqual({ enabled: true, intensity: 80 });
    expect(service.levels()).toEqual({ smoke: 80, spray: 0, strobe: 0 });
  });

  it('clamps intensity into 0–100', () => {
    const { service } = create();

    service.setIntensity('spray', 400);
    expect(service.spray().intensity).toBe(100);
    service.setIntensity('spray', -3);
    expect(service.spray().intensity).toBe(0);
  });

  it('replaces state immutably', () => {
    const { service } = create();
    const before = service.state();

    service.setEnabled('smoke', true);

    expect(service.state()).not.toBe(before);
    expect(before.smoke.enabled).toBe(false);
  });

  it('suppresses spray when freezing or in strong wind, keeping the setting', () => {
    const { service } = create();
    service.setEnabled('spray', true);
    expect(service.levels().spray).toBe(50);

    weather.setConditions(createConditions({ temperatureCelsius: -2 }));
    expect(service.sprayBlockedReason()).toBe('freezing');
    expect(service.levels().spray).toBe(0);
    expect(service.spray().enabled).toBe(true);

    weather.setConditions(createConditions({ temperatureCelsius: 12, regime: 'StrongWind' }));
    expect(service.sprayBlockedReason()).toBe('strong-wind');
    expect(service.levels().spray).toBe(0);

    weather.setConditions(createConditions({ temperatureCelsius: 12 }));
    expect(service.levels().spray).toBe(50);
  });

  it('refuses to switch the strobe on when reduced motion is preferred', () => {
    const { service } = create(true);

    expect(service.reducedMotion()).toBe(true);
    service.setEnabled('strobe', true);

    expect(service.strobe().enabled).toBe(false);
    expect(service.levels().strobe).toBe(0);
  });

  it('forces a running strobe off when reduced motion is turned on', () => {
    const { service, mql } = create(false);
    service.setEnabled('strobe', true);
    expect(service.levels().strobe).toBe(50);

    mql.change(true);

    expect(service.reducedMotion()).toBe(true);
    expect(service.levels().strobe).toBe(0);
  });

  it('works without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: WEATHER_SOURCE, useValue: new FakeWeatherSource() }],
    });

    expect(TestBed.inject(EffectsStateService).reducedMotion()).toBe(false);
  });
});
