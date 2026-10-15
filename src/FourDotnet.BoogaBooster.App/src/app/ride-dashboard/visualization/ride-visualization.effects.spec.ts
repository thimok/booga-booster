import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { NO_EFFECTS } from '../../effects/effects-state.service';
import { createConditions } from '../../weather/testing/fake-weather-source';
import { RideVisualization, WEBGL_RENDERER_FACTORY } from './ride-visualization';

/** Captured from the stand-in renderer so specs can drive frames and inspect the scene. */
const captured = {
  loop: null as (() => void) | null,
  scene: null as unknown,
  animationLoopCleared: false,
};

/** Minimal stand-in for the parts of `WebGLRenderer` the visualization uses. */
class FakeRenderer {
  domElement = document.createElement('canvas');
  shadowMap = { enabled: false, type: 0 };
  setPixelRatio(): void {}
  setSize(): void {}
  setAnimationLoop(callback: (() => void) | null): void {
    captured.loop = callback;
    captured.animationLoopCleared = callback === null;
  }
  render(scene: unknown): void {
    captured.scene = scene;
  }
  dispose(): void {}
}

describe('RideVisualization effects', () => {
  beforeEach(() => {
    captured.loop = null;
    captured.scene = null;
    captured.animationLoopCleared = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WEBGL_RENDERER_FACTORY,
          useValue: () => new FakeRenderer() as unknown as THREE.WebGLRenderer,
        },
      ],
    });
    const fixture = TestBed.createComponent(RideVisualization);
    const base = {
      millSpeedRpm: 6,
      millDirection: 'forward',
      hubSpeedRpm: 9,
      hubDirection: 'reverse',
      gondolaBrakeEngaged: false,
      ...inputs,
    };
    for (const [name, value] of Object.entries(base)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function frame(): THREE.Scene {
    captured.loop?.();
    return captured.scene as THREE.Scene;
  }

  const allPoints = (scene: THREE.Scene) =>
    scene.children.filter((c): c is THREE.Points => c instanceof THREE.Points);
  const strobeLight = (scene: THREE.Scene) =>
    scene.children.find((c): c is THREE.PointLight => c instanceof THREE.PointLight);

  it('defaults to no effects and no weather', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.effects()).toEqual(NO_EFFECTS);
    expect(fixture.componentInstance.weather()).toBeNull();
    const scene = frame();
    expect(allPoints(scene)).toHaveLength(2);
    expect(allPoints(scene).every((p) => !p.visible)).toBe(true);
    expect(strobeLight(scene)?.visible).toBe(false);
  });

  it('renders smoke and spray particles when switched on in mild weather', async () => {
    await render({
      effects: { smoke: 80, spray: 60, strobe: 0 },
      weather: createConditions({ temperatureCelsius: 18 }),
    });

    expect(allPoints(frame()).every((p) => p.visible)).toBe(true);
  });

  it('suppresses spray when freezing but keeps smoke', async () => {
    await render({
      effects: { smoke: 80, spray: 60, strobe: 0 },
      weather: createConditions({ temperatureCelsius: -2 }),
    });

    const [smoke, spray] = allPoints(frame());
    expect(smoke.visible).toBe(true);
    expect(spray.visible).toBe(false);
  });

  it('suppresses spray in a strong-wind regime', async () => {
    await render({
      effects: { smoke: 0, spray: 60, strobe: 0 },
      weather: createConditions({ temperatureCelsius: 18, regime: 'StrongWind' }),
    });

    expect(allPoints(frame()).every((p) => !p.visible)).toBe(true);
  });

  it('flashes the strobe light and stops when switched off', async () => {
    const fixture = await render({ effects: { smoke: 0, spray: 0, strobe: 100 } });

    expect(strobeLight(frame())?.visible).toBe(true);

    fixture.componentRef.setInput('effects', NO_EFFECTS);
    expect(strobeLight(frame())?.visible).toBe(false);
  });

  it('never flashes more than 3 times per second of simulated time', async () => {
    await render({ effects: { smoke: 0, spray: 0, strobe: 100 } });
    // Each frame advances the real clock by a few ms at most; sample many frames.
    let lastLit = false;
    let rising = 0;
    const start = performance.now();
    while (performance.now() - start < 300) {
      const lit = strobeLight(frame())?.visible ?? false;
      if (lit && !lastLit) {
        rising++;
      }
      lastLit = lit;
    }
    expect(rising).toBeLessThanOrEqual(3);
  });

  it('removes the effects from the scene and stops the loop on destroy', async () => {
    const fixture = await render({ effects: { smoke: 80, spray: 60, strobe: 100 } });
    const scene = frame();
    expect(allPoints(scene)).toHaveLength(2);

    fixture.destroy();

    expect(captured.animationLoopCleared).toBe(true);
    expect(allPoints(scene)).toHaveLength(0);
    expect(strobeLight(scene)).toBeUndefined();
  });
});
