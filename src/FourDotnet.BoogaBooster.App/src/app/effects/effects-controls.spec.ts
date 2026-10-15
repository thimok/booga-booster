import { TestBed } from '@angular/core/testing';

import { WEATHER_SOURCE } from '../weather/data/weather-source';
import { FakeWeatherSource, createConditions } from '../weather/testing/fake-weather-source';
import { EffectsStateService } from './effects-state.service';
import { EffectsControls } from './effects-controls';

describe('EffectsControls', () => {
  let weather: FakeWeatherSource;

  function render(reducedMotion = false) {
    vi.stubGlobal('matchMedia', () => ({
      matches: reducedMotion,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    weather = new FakeWeatherSource();
    weather.setStatus('ready');
    weather.setConditions(createConditions({ temperatureCelsius: 15 }));
    TestBed.configureTestingModule({ providers: [{ provide: WEATHER_SOURCE, useValue: weather }] });
    const fixture = TestBed.createComponent(EffectsControls);
    fixture.detectChanges();
    return fixture;
  }

  function el(fixture: { nativeElement: unknown }): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function switchFor(root: HTMLElement, id: string): HTMLInputElement {
    return root.querySelector<HTMLInputElement>(`#${id}-toggle`)!;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('is a labelled region with a smoke, spray and strobe switch, all off', () => {
    const root = el(render());

    expect(root.querySelector('section')?.getAttribute('aria-labelledby')).toBe('effects-heading');
    expect(root.querySelector('#effects-heading')?.textContent).toBe('Effects');
    for (const id of ['effect-smoke', 'effect-spray', 'effect-strobe']) {
      const input = switchFor(root, id);
      expect(input.getAttribute('role')).toBe('switch');
      expect(input.checked).toBe(false);
      expect(root.querySelector(`label[for="${id}-toggle"]`)).not.toBeNull();
    }
  });

  it('switches an effect on when its toggle is clicked, and off again', async () => {
    const fixture = render();
    const root = el(fixture);
    const state = TestBed.inject(EffectsStateService);

    switchFor(root, 'effect-smoke').click();
    await fixture.whenStable();
    expect(state.smoke().enabled).toBe(true);
    expect(switchFor(root, 'effect-smoke').checked).toBe(true);

    switchFor(root, 'effect-smoke').click();
    await fixture.whenStable();
    expect(state.smoke().enabled).toBe(false);
  });

  it('shows the photosensitivity warning next to the strobe toggle', () => {
    const text = el(render()).textContent;

    expect(text).toContain('Photosensitivity warning');
    expect(text).toContain('3 flashes per second');
  });

  it('keeps the strobe available when reduced motion is not preferred', () => {
    const root = el(render(false));

    expect(switchFor(root, 'effect-strobe').disabled).toBe(false);
    expect(root.textContent).not.toContain('prefers reduced motion');
  });

  it('disables the strobe and explains why under reduced motion', () => {
    const root = el(render(true));

    expect(switchFor(root, 'effect-strobe').disabled).toBe(true);
    expect(switchFor(root, 'effect-smoke').disabled).toBe(false);
    expect(root.textContent).toContain('prefers reduced motion');
  });

  it('explains when spray is unavailable', async () => {
    const fixture = render();
    const root = el(fixture);
    expect(root.textContent).not.toContain('Water spray is unavailable');

    weather.setConditions(createConditions({ temperatureCelsius: -3 }));
    fixture.detectChanges();
    expect(root.textContent).toContain('because of freezing temperatures');

    weather.setConditions(createConditions({ temperatureCelsius: 10, regime: 'StrongWind' }));
    fixture.detectChanges();
    expect(root.textContent).toContain('because of strong wind');
  });

  it('exposes every intensity slider with a name', () => {
    const root = el(render());

    for (const id of ['effect-smoke', 'effect-spray', 'effect-strobe']) {
      expect(root.querySelector(`#${id}-intensity-label`)?.textContent).toContain('intensity');
    }
    expect(root.querySelectorAll('p-slider').length).toBe(3);
  });
});
