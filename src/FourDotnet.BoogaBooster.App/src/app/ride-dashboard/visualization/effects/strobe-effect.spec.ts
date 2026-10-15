import * as THREE from 'three';

import { MAX_STROBE_HZ } from '../../../effects/effects.models';
import { RideEffectGeometry } from './scene-effect';
import { StrobeEffect } from './strobe-effect';

const GEOMETRY: RideEffectGeometry = { baseHalfSize: 1.7, baseTopY: 0.35, armHeightY: 6 };
const BASE_AMBIENT = 1;

describe('StrobeEffect', () => {
  let scene: THREE.Scene;
  let ambient: THREE.HemisphereLight;
  let strobe: StrobeEffect;

  beforeEach(() => {
    scene = new THREE.Scene();
    ambient = new THREE.HemisphereLight(0xffffff, 0x000000, BASE_AMBIENT);
    scene.add(ambient);
    strobe = new StrobeEffect(scene, ambient, GEOMETRY);
  });

  const light = () => scene.children.find((c) => c instanceof THREE.PointLight) as THREE.PointLight;

  it('is dark and leaves the lighting alone while off', () => {
    strobe.update(0, 0);

    expect(light().visible).toBe(false);
    expect(light().intensity).toBe(0);
    expect(ambient.intensity).toBe(BASE_AMBIENT);
  });

  it('never lights the scene more than 3 times per second at full intensity', () => {
    let flashes = 0;
    let wasLit = false;
    for (let i = 0; i < 1000; i++) {
      strobe.update(i / 1000, 100);
      const lit = light().visible;
      if (lit && !wasLit) {
        flashes++;
      }
      wasLit = lit;
    }
    expect(flashes).toBeLessThanOrEqual(MAX_STROBE_HZ);
    expect(flashes).toBeGreaterThan(0);
  });

  it('lifts the hemisphere light only during a flash', () => {
    strobe.update(0, 100); // start of a pulse
    expect(ambient.intensity).toBeGreaterThan(BASE_AMBIENT);

    strobe.update(0.3, 100); // between pulses
    expect(ambient.intensity).toBe(BASE_AMBIENT);
    expect(light().visible).toBe(false);
  });

  it('stops flashing and restores normal lighting the moment it is switched off', () => {
    strobe.update(0, 100);
    strobe.update(0.01, 0);

    expect(light().visible).toBe(false);
    expect(ambient.intensity).toBe(BASE_AMBIENT);
  });

  it('restores the lighting and removes its light on dispose', () => {
    strobe.update(0, 100);
    strobe.dispose();

    expect(ambient.intensity).toBe(BASE_AMBIENT);
    expect(scene.children.some((c) => c instanceof THREE.PointLight)).toBe(false);
  });
});
