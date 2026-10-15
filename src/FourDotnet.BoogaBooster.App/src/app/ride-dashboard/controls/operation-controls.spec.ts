import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RIDE_TELEMETRY_SOURCE } from '../data/ride-telemetry-source';
import { AUTO_MODE_INACTIVE, AutoModeStatus, RideState } from '../models/ride.models';
import { RideLifecycleService } from '../state/ride-lifecycle.service';
import { FakeRideTelemetrySource } from '../testing/fake-ride-telemetry-source';
import { OperationControls } from './operation-controls';

/**
 * Minimal stand-in for {@link RideLifecycleService} exposing just the
 * settable `state` signal `OperationControls` reads, so specs can drive the
 * lifecycle state synchronously without the real service's HTTP polling.
 */
class StubRideLifecycleService {
  private readonly stateSignal = signal<RideState>('started');

  readonly state = this.stateSignal.asReadonly();
  readonly availableTransitions = signal<readonly RideState[]>([]).asReadonly();

  private readonly autoModeSignal = signal<AutoModeStatus>(AUTO_MODE_INACTIVE);
  readonly autoMode = this.autoModeSignal.asReadonly();

  readonly startAuto = vi.fn();
  readonly stopAuto = vi.fn();

  setAutoMode(status: AutoModeStatus): void {
    this.autoModeSignal.set(status);
  }

  setState(state: RideState): void {
    this.stateSignal.set(state);
  }

  requestTransition(): void {
    // Unused by OperationControls; present only to shape-match the real service.
  }
}

describe('OperationControls', () => {
  let source: FakeRideTelemetrySource;
  let lifecycle: StubRideLifecycleService;

  function render() {
    const fixture = TestBed.createComponent(OperationControls);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    source = new FakeRideTelemetrySource();
    lifecycle = new StubRideLifecycleService();
    TestBed.configureTestingModule({
      providers: [
        { provide: RIDE_TELEMETRY_SOURCE, useValue: source },
        { provide: RideLifecycleService, useValue: lifecycle },
      ],
    });
  });

  it('emits a clamped mill-power command when the slider changes', () => {
    const fixture = render();
    const slider = fixture.nativeElement.querySelector('#mill-power') as HTMLInputElement;

    slider.value = '150';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(source.commands).toContainEqual({ kind: 'set-mill-power', value: 100 });
  });

  it('emits a hub-power command when the hub slider changes', () => {
    const fixture = render();
    const slider = fixture.nativeElement.querySelector('#hub-power') as HTMLInputElement;

    slider.value = '45';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(source.commands).toContainEqual({ kind: 'set-hub-power', value: 45 });
  });

  it('toggles mill direction and exposes the pressed state', () => {
    const fixture = render();
    const toggle = fixture.nativeElement.querySelector(
      '.toggle[aria-labelledby="mill-dir-label"]',
    ) as HTMLButtonElement;

    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(source.commands).toContainEqual({ kind: 'set-mill-direction', direction: 'reverse' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent?.trim()).toBe('Reverse');
  });

  it('stays in sync when power changes elsewhere', () => {
    const fixture = render();
    source.applyCommand({ kind: 'set-mill-power', value: 70 });
    fixture.detectChanges();

    const slider = fixture.nativeElement.querySelector('#mill-power') as HTMLInputElement;
    expect(slider.value).toBe('70');
  });

  it('toggles the gondola brake and reflects its label and pressed state', () => {
    const fixture = render();
    const brake = fixture.nativeElement.querySelector('.toggle.brake') as HTMLButtonElement;

    expect(brake.getAttribute('aria-pressed')).toBe('false');
    expect(brake.textContent?.trim()).toBe('Gondolas Released');

    brake.click();
    fixture.detectChanges();

    expect(source.commands).toContainEqual({ kind: 'set-gondola-brake', engaged: true });
    expect(brake.getAttribute('aria-pressed')).toBe('true');
    expect(brake.textContent?.trim()).toBe('Gondolas Break');
  });

  it('disables every control and shows the hint when the ride is not started', () => {
    lifecycle.setState('idle');
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;

    expect((host.querySelector('#mill-power') as HTMLInputElement).disabled).toBe(true);
    expect((host.querySelector('#hub-power') as HTMLInputElement).disabled).toBe(true);
    expect(
      (host.querySelector('.toggle[aria-labelledby="mill-dir-label"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (host.querySelector('.toggle[aria-labelledby="hub-dir-label"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect((host.querySelector('.toggle.brake') as HTMLButtonElement).disabled).toBe(true);
    expect((host.querySelector('.apply-brakes') as HTMLButtonElement).disabled).toBe(true);

    const hint = host.querySelector('#controls-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('Controls become available once the ride is started.');
    expect(host.querySelector('.controls')?.getAttribute('aria-describedby')).toBe('controls-hint');
  });

  it('enables every control and hides the hint once the ride is started', () => {
    lifecycle.setState('started');
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;

    expect((host.querySelector('#mill-power') as HTMLInputElement).disabled).toBe(false);
    expect((host.querySelector('#hub-power') as HTMLInputElement).disabled).toBe(false);
    expect((host.querySelector('.toggle.brake') as HTMLButtonElement).disabled).toBe(false);
    expect((host.querySelector('.apply-brakes') as HTMLButtonElement).disabled).toBe(false);
    expect(host.querySelector('#controls-hint')).toBeNull();
  });

  it('engages the engine brake toggle when clicked while started, and reflects aria-pressed', () => {
    lifecycle.setState('started');
    const fixture = render();
    const button = fixture.nativeElement.querySelector('.apply-brakes') as HTMLButtonElement;

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent?.trim()).toBe('Apply brakes');

    button.click();
    fixture.detectChanges();

    expect(source.commands).toContainEqual({ kind: 'brake-engines', engaged: true });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent?.trim()).toBe('Release brakes');
  });

  it('releases the engine brake toggle when clicked again', () => {
    lifecycle.setState('started');
    const fixture = render();
    const button = fixture.nativeElement.querySelector('.apply-brakes') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();

    expect(source.commands).toContainEqual({ kind: 'brake-engines', engaged: false });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent?.trim()).toBe('Apply brakes');
  });

  it('disables the power sliders while the engine brake is engaged, and re-enables on release', () => {
    lifecycle.setState('started');
    const fixture = render();
    const millSlider = fixture.nativeElement.querySelector('#mill-power') as HTMLInputElement;
    const hubSlider = fixture.nativeElement.querySelector('#hub-power') as HTMLInputElement;
    const button = fixture.nativeElement.querySelector('.apply-brakes') as HTMLButtonElement;

    expect(millSlider.disabled).toBe(false);
    expect(hubSlider.disabled).toBe(false);

    button.click();
    fixture.detectChanges();

    expect(millSlider.disabled).toBe(true);
    expect(hubSlider.disabled).toBe(true);
    // The toggle itself stays enabled so the operator can release it again.
    expect(button.disabled).toBe(false);

    button.click();
    fixture.detectChanges();

    expect(millSlider.disabled).toBe(false);
    expect(hubSlider.disabled).toBe(false);
  });

  describe('auto mode', () => {
    const active: AutoModeStatus = {
      isActive: true,
      phase: 'cruise',
      canStart: false,
      canStop: true,
    };
    const startable: AutoModeStatus = {
      isActive: false,
      phase: 'inactive',
      canStart: true,
      canStop: false,
    };

    function autoButton(host: HTMLElement, label: string): HTMLButtonElement {
      const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) => candidate.textContent?.trim() === label,
      );
      if (!button) {
        throw new Error(`No button "${label}"`);
      }
      return button;
    }

    it('lights Start auto and disables Stop auto when a start is legal', () => {
      lifecycle.setState('safe');
      lifecycle.setAutoMode(startable);
      const host = render().nativeElement as HTMLElement;

      expect(autoButton(host, 'Start auto').disabled).toBe(false);
      expect(autoButton(host, 'Stop auto').disabled).toBe(true);
    });

    it('lights Stop auto and disables Start auto while auto runs', () => {
      lifecycle.setAutoMode(active);
      const host = render().nativeElement as HTMLElement;

      expect(autoButton(host, 'Start auto').disabled).toBe(true);
      expect(autoButton(host, 'Stop auto').disabled).toBe(false);
    });

    it('disables both buttons when the ride is idle', () => {
      lifecycle.setState('idle');
      const host = render().nativeElement as HTMLElement;

      expect(autoButton(host, 'Start auto').disabled).toBe(true);
      expect(autoButton(host, 'Stop auto').disabled).toBe(true);
    });

    it('requests start and stop from the lifecycle service', () => {
      lifecycle.setAutoMode({ ...startable, canStop: true });
      const host = render().nativeElement as HTMLElement;

      autoButton(host, 'Start auto').click();
      autoButton(host, 'Stop auto').click();

      expect(lifecycle.startAuto).toHaveBeenCalledTimes(1);
      expect(lifecycle.stopAuto).toHaveBeenCalledTimes(1);
    });

    it('locks sliders, direction toggles and brakes and explains why', () => {
      lifecycle.setAutoMode(active);
      const host = render().nativeElement as HTMLElement;

      expect((host.querySelector('#mill-power') as HTMLInputElement).disabled).toBe(true);
      expect((host.querySelector('#hub-power') as HTMLInputElement).disabled).toBe(true);
      host.querySelectorAll<HTMLButtonElement>('.toggle, .apply-brakes').forEach((button) => {
        expect(button.disabled).toBe(true);
      });
      expect(host.querySelector('#controls-hint')?.textContent).toContain(
        'Auto mode is controlling the ride',
      );
    });

    it('sends no commands from locked controls', () => {
      lifecycle.setAutoMode(active);
      const host = render().nativeElement as HTMLElement;

      host
        .querySelectorAll<HTMLButtonElement>('.toggle, .apply-brakes')
        .forEach((button) => button.click());

      expect(source.commands).toEqual([]);
    });

    it('shows the programme power on the sliders', () => {
      lifecycle.setAutoMode(active);
      const fixture = render();
      source.setTelemetry({
        ...source.telemetry(),
        mill: { power: 40, direction: 'forward', speedRpm: 3 },
      });
      fixture.detectChanges();

      expect((fixture.nativeElement.querySelector('#mill-power') as HTMLInputElement).value).toBe(
        '40',
      );
    });

    it('returns the manual controls once auto mode has ended', () => {
      lifecycle.setAutoMode(active);
      const fixture = render();
      lifecycle.setAutoMode(AUTO_MODE_INACTIVE);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect((host.querySelector('#mill-power') as HTMLInputElement).disabled).toBe(false);
      expect(host.querySelector('#controls-hint')).toBeNull();
    });
  });
});
