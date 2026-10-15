import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';

import { WEATHER_SOURCE } from '../weather/data/weather-source';
import { FakeWeatherSource, createConditions } from '../weather/testing/fake-weather-source';
import { EffectsControls } from './effects-controls';

describe('EffectsControls accessibility', () => {
  async function audit(reducedMotion: boolean, temperature: number) {
    vi.stubGlobal('matchMedia', () => ({
      matches: reducedMotion,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const weather = new FakeWeatherSource();
    weather.setStatus('ready');
    weather.setConditions(createConditions({ temperatureCelsius: temperature }));
    TestBed.configureTestingModule({ providers: [{ provide: WEATHER_SOURCE, useValue: weather }] });
    const fixture = TestBed.createComponent(EffectsControls);
    fixture.detectChanges();
    await fixture.whenStable();

    return axe.run(fixture.nativeElement as HTMLElement, {
      resultTypes: ['violations'],
      // Contrast needs real layout/colour, unavailable in jsdom.
      rules: { 'color-contrast': { enabled: false } },
    });
  }

  afterEach(() => vi.unstubAllGlobals());

  it('has no AXE violations', async () => {
    expect((await audit(false, 15)).violations).toEqual([]);
  });

  it('has no AXE violations with the strobe locked out and spray unavailable', async () => {
    expect((await audit(true, -5)).violations).toEqual([]);
  });
});
