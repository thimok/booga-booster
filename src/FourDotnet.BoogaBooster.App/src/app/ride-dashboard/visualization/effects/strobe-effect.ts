import * as THREE from 'three';

import { strobeLevel } from '../../../effects/effects.models';
import { RideEffectGeometry, SceneEffect } from './scene-effect';

const STROBE_COLOR = 0xffffff;
/** Point-light intensity (candela) at the capped strobe level of 1. */
const STROBE_LIGHT_INTENSITY = 1400;
const STROBE_LIGHT_DISTANCE = 70;
const STROBE_LIGHT_DECAY = 1.4;
/** Height of the strobe light above the arm plane. */
const STROBE_LIGHT_LIFT = 4;
/** Extra hemisphere intensity at the capped strobe level of 1 — lifts the whole scene a little. */
const STROBE_AMBIENT_BOOST = 0.8;

/**
 * Stroboscope: a white point light above the ride plus a brief lift of the
 * hemisphere light. Brightness follows {@link strobeLevel}, which is hard-capped
 * at 3 flashes per second and below full white. Switching off restores the
 * normal lighting immediately.
 */
export class StrobeEffect implements SceneEffect {
  private readonly light = new THREE.PointLight(
    STROBE_COLOR,
    0,
    STROBE_LIGHT_DISTANCE,
    STROBE_LIGHT_DECAY,
  );
  private readonly baseAmbient: number;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ambient: THREE.HemisphereLight,
    anchor: RideEffectGeometry,
  ) {
    this.baseAmbient = ambient.intensity;
    this.light.position.set(0, anchor.armHeightY + STROBE_LIGHT_LIFT, 0);
    this.light.visible = false;
    this.scene.add(this.light);
  }

  /** `timeSeconds` is the running strobe clock; `intensity` is 0–100 (0 = off). */
  update(timeSeconds: number, intensity: number): void {
    const level = strobeLevel(timeSeconds, intensity);
    this.light.visible = level > 0;
    this.light.intensity = level * STROBE_LIGHT_INTENSITY;
    this.ambient.intensity = this.baseAmbient + level * STROBE_AMBIENT_BOOST;
  }

  dispose(): void {
    this.ambient.intensity = this.baseAmbient;
    this.scene.remove(this.light);
    this.light.dispose();
  }
}
