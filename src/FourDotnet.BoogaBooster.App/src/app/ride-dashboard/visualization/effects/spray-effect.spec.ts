import * as THREE from 'three';

import { MAX_SPRAY_PARTICLES } from '../../../effects/effects.models';
import { RideEffectGeometry } from './scene-effect';
import { SprayEffect } from './spray-effect';

const GEOMETRY: RideEffectGeometry = { baseHalfSize: 1.7, baseTopY: 0.35, armHeightY: 6 };

describe('SprayEffect', () => {
  let scene: THREE.Scene;
  let spray: SprayEffect;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    scene = new THREE.Scene();
    spray = new SprayEffect(scene, GEOMETRY);
  });

  afterEach(() => vi.restoreAllMocks());

  const points = () => scene.children[0] as THREE.Points;
  const positions = () => points().geometry.attributes['position'].array;

  it('is hidden and idle while off (intensity 0, e.g. suppressed by weather)', () => {
    const before = Array.from(positions());
    spray.update(0.016, 0);

    expect(points().visible).toBe(false);
    expect(Array.from(positions())).toEqual(before);
  });

  it('scales the number of droplets with intensity', () => {
    spray.update(0.016, 30);
    expect(points().geometry.drawRange.count).toBe(Math.round(MAX_SPRAY_PARTICLES * 0.3));

    spray.update(0.016, 80);
    expect(points().geometry.drawRange.count).toBe(Math.round(MAX_SPRAY_PARTICLES * 0.8));
  });

  it('keeps droplets at or above the ground and finite while falling and re-launching', () => {
    for (let frame = 0; frame < 300; frame++) {
      spray.update(0.016, 100);
    }
    for (let i = 0; i < MAX_SPRAY_PARTICLES * 3; i++) {
      expect(Number.isFinite(positions()[i])).toBe(true);
    }
    for (let i = 0; i < MAX_SPRAY_PARTICLES; i++) {
      expect(positions()[i * 3 + 1]).toBeGreaterThan(-1);
    }
  });

  it('sprays outward from the ring rather than straight from the tower', () => {
    let beyondBase = 0;
    for (let i = 0; i < MAX_SPRAY_PARTICLES; i++) {
      const radius = Math.hypot(positions()[i * 3], positions()[i * 3 + 2]);
      if (radius > GEOMETRY.baseHalfSize) {
        beyondBase++;
      }
    }
    expect(beyondBase).toBeGreaterThan(MAX_SPRAY_PARTICLES * 0.9);
  });

  it('removes itself from the scene and disposes its resources', () => {
    const geometryDispose = vi.spyOn(points().geometry, 'dispose');
    const materialDispose = vi.spyOn(points().material as THREE.Material, 'dispose');

    spray.dispose();

    expect(scene.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalled();
  });
});
