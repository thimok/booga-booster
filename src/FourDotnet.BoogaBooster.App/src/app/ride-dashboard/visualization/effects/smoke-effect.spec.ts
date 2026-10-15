import { RideEffectGeometry } from './scene-effect';
import * as THREE from 'three';

import { MAX_SMOKE_PARTICLES } from '../../../effects/effects.models';
import { SmokeEffect } from './smoke-effect';

const GEOMETRY: RideEffectGeometry = { baseHalfSize: 1.7, baseTopY: 0.35, armHeightY: 6 };

describe('SmokeEffect', () => {
  let scene: THREE.Scene;
  let smoke: SmokeEffect;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    scene = new THREE.Scene();
    smoke = new SmokeEffect(scene, GEOMETRY);
  });

  afterEach(() => vi.restoreAllMocks());

  function points(): THREE.Points {
    return scene.children[0] as THREE.Points;
  }

  function meanX(count: number): number {
    const positions = points().geometry.attributes['position'].array;
    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += positions[i * 3];
    }
    return sum / count;
  }

  it('is added hidden and does no work while off', () => {
    expect(scene.children).toHaveLength(1);
    expect(points().visible).toBe(false);

    const before = Array.from(points().geometry.attributes['position'].array);
    smoke.update(0.016, 0, 3);

    expect(points().visible).toBe(false);
    expect(Array.from(points().geometry.attributes['position'].array)).toEqual(before);
  });

  it('scales the drawn particles with intensity', () => {
    smoke.update(0.016, 50, 0);
    expect(points().visible).toBe(true);
    expect(points().geometry.drawRange.count).toBe(MAX_SMOKE_PARTICLES / 2);

    smoke.update(0.016, 100, 0);
    expect(points().geometry.drawRange.count).toBe(MAX_SMOKE_PARTICLES);
  });

  it('rises and drifts downwind in strong wind, but not in calm air', () => {
    const calm = new THREE.Scene();
    const calmSmoke = new SmokeEffect(calm, GEOMETRY);
    const windy = meanXAfter(smoke, scene, 6);
    const still = meanXAfter(calmSmoke, calm, 0);

    expect(windy).toBeGreaterThan(still + 0.5);
  });

  it('keeps particles above the base while rising', () => {
    smoke.update(0.016, 100, 0);
    const positions = points().geometry.attributes['position'].array;
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
      expect(positions[i * 3 + 1]).toBeGreaterThanOrEqual(GEOMETRY.baseTopY - 1e-4);
    }
    expect(meanX(MAX_SMOKE_PARTICLES)).not.toBeNaN();
  });

  it('removes itself from the scene and disposes its resources', () => {
    const geometryDispose = vi.spyOn(points().geometry, 'dispose');
    const materialDispose = vi.spyOn(points().material as THREE.Material, 'dispose');

    smoke.dispose();

    expect(scene.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalled();
  });
});

/** Runs the effect for a while and returns the mean X of its particles. */
function meanXAfter(effect: SmokeEffect, scene: THREE.Scene, drift: number): number {
  for (let frame = 0; frame < 120; frame++) {
    effect.update(0.016, 100, drift);
  }
  const positions = (scene.children[0] as THREE.Points).geometry.attributes['position'].array;
  let sum = 0;
  for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
    sum += positions[i * 3];
  }
  return sum / MAX_SMOKE_PARTICLES;
}
