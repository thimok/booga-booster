import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';

import { RIDE_TELEMETRY_SOURCE } from '../data/ride-telemetry-source';
import { AUTO_MODE_INACTIVE, AutoModeStatus, RideState } from '../models/ride.models';
import { RideLifecycleService } from '../state/ride-lifecycle.service';
import { FakeRideTelemetrySource } from '../testing/fake-ride-telemetry-source';
import { OperationControls } from './operation-controls';

const ACTIVE: AutoModeStatus = { isActive: true, phase: 'cruise', canStart: false, canStop: true };
const STARTABLE: AutoModeStatus = {
  isActive: false,
  phase: 'inactive',
  canStart: true,
  canStop: false,
};

function stubLifecycle(state: RideState, autoMode: AutoModeStatus) {
  return {
    state: signal(state).asReadonly(),
    availableTransitions: signal<readonly RideState[]>([]).asReadonly(),
    autoMode: signal(autoMode).asReadonly(),
    startAuto: () => undefined,
    stopAuto: () => undefined,
    requestTransition: () => undefined,
  };
}

async function audit(state: RideState, autoMode: AutoModeStatus): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      { provide: RIDE_TELEMETRY_SOURCE, useValue: new FakeRideTelemetrySource() },
      { provide: RideLifecycleService, useValue: stubLifecycle(state, autoMode) },
    ],
  });
  const fixture = TestBed.createComponent(OperationControls);
  fixture.detectChanges();
  await fixture.whenStable();

  const results = await axe.run(fixture.nativeElement as HTMLElement, {
    resultTypes: ['violations'],
    // Contrast needs real layout/colour, unavailable in jsdom.
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(results.violations).toEqual([]);
  return fixture.nativeElement as HTMLElement;
}

describe('OperationControls accessibility', () => {
  it('has no AXE violations while auto mode is inactive', async () => {
    const host = await audit('safe', STARTABLE);

    const stop = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Stop auto',
    );
    expect(stop?.disabled).toBe(true);
  });

  it('has no AXE violations while auto mode is active', async () => {
    const host = await audit('started', ACTIVE);

    expect(host.querySelector('#controls-hint')?.textContent).toContain('Auto mode');
  });

  it('has no AXE violations while the ride is idle', async () => {
    await audit('idle', AUTO_MODE_INACTIVE);
  });
});
