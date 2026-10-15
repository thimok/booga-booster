import * as THREE from 'three';

import { MAX_SMOKE_PARTICLES, createRng, particleCount } from '../../../effects/effects.models';
import { RideEffectGeometry, SceneEffect, createSoftSpriteTexture } from './scene-effect';

/** Seed for the visual-only RNG (kept apart from the simulation's samplers). */
const SMOKE_SEED = 0x5a0c3;

const SMOKE_COLOR = new THREE.Color(0xc4c8d2);
/** Smoke fades into this colour as it ages (close to the ground/background). */
const SMOKE_FADE_COLOR = new THREE.Color(0x232c3d);

const SMOKE_SPRITE_SIZE = 1.8;
const SMOKE_LIFE_MIN_S = 4;
const SMOKE_LIFE_SPAN_S = 3;
const SMOKE_RISE_MIN = 0.7;
const SMOKE_RISE_SPAN = 0.6;
/** Share of the base half-size the plumes are emitted across. */
const SMOKE_SPAWN_SPREAD = 0.9;
/** Sideways wobble amplitude, in metres per second. */
const SMOKE_SWAY = 0.25;
/** Drift of a fresh puff relative to a fully aged one (smoke leans over as it rises). */
const SMOKE_DRIFT_BASE = 0.4;

/** Smoke plumes rising from the base of the ride and blown downwind (+X). */
export class SmokeEffect implements SceneEffect {
  private readonly rng = createRng(SMOKE_SEED);
  private readonly positions = new Float32Array(MAX_SMOKE_PARTICLES * 3);
  private readonly colors = new Float32Array(MAX_SMOKE_PARTICLES * 3);
  private readonly ages = new Float32Array(MAX_SMOKE_PARTICLES);
  private readonly lives = new Float32Array(MAX_SMOKE_PARTICLES);
  private readonly rises = new Float32Array(MAX_SMOKE_PARTICLES);
  private readonly phases = new Float32Array(MAX_SMOKE_PARTICLES);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly texture = createSoftSpriteTexture();
  private readonly material = new THREE.PointsMaterial({
    size: SMOKE_SPRITE_SIZE,
    map: this.texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  private readonly points = new THREE.Points(this.geometry, this.material);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly anchor: RideEffectGeometry,
  ) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points.frustumCulled = false;
    this.points.visible = false;
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
      this.respawn(i, this.rng());
    }
    this.scene.add(this.points);
  }

  /**
   * Advances the plumes. `intensity` is 0–100 (0 = off); `driftSpeed` is the
   * downwind speed in m/s. Does no work while off.
   */
  update(deltaSeconds: number, intensity: number, driftSpeed: number): void {
    const count = particleCount(MAX_SMOKE_PARTICLES, intensity);
    this.points.visible = count > 0;
    if (count === 0) {
      return;
    }
    this.geometry.setDrawRange(0, count);

    for (let i = 0; i < count; i++) {
      this.ages[i] += deltaSeconds;
      const progress = this.ages[i] / this.lives[i];
      if (progress >= 1) {
        this.respawn(i, 0);
        continue;
      }
      const o = i * 3;
      this.positions[o] +=
        (driftSpeed * (SMOKE_DRIFT_BASE + progress) +
          Math.sin(this.ages[i] + this.phases[i]) * SMOKE_SWAY) *
        deltaSeconds;
      this.positions[o + 1] += this.rises[i] * deltaSeconds;
      this.positions[o + 2] += Math.cos(this.ages[i] + this.phases[i]) * SMOKE_SWAY * deltaSeconds;
      this.writeColor(i, progress);
    }
    this.geometry.attributes['position'].needsUpdate = true;
    this.geometry.attributes['color'].needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  /** Re-emits a puff from the base; `progress` pre-ages it so the plume starts mid-stream. */
  private respawn(i: number, progress: number): void {
    const spread = this.anchor.baseHalfSize * SMOKE_SPAWN_SPREAD;
    this.lives[i] = SMOKE_LIFE_MIN_S + this.rng() * SMOKE_LIFE_SPAN_S;
    this.ages[i] = progress * this.lives[i];
    this.rises[i] = SMOKE_RISE_MIN + this.rng() * SMOKE_RISE_SPAN;
    this.phases[i] = this.rng() * Math.PI * 2;
    const o = i * 3;
    this.positions[o] = (this.rng() * 2 - 1) * spread;
    this.positions[o + 1] = this.anchor.baseTopY + this.rises[i] * this.ages[i];
    this.positions[o + 2] = (this.rng() * 2 - 1) * spread;
    this.writeColor(i, progress);
  }

  private writeColor(i: number, progress: number): void {
    const o = i * 3;
    this.colors[o] = SMOKE_COLOR.r + (SMOKE_FADE_COLOR.r - SMOKE_COLOR.r) * progress;
    this.colors[o + 1] = SMOKE_COLOR.g + (SMOKE_FADE_COLOR.g - SMOKE_COLOR.g) * progress;
    this.colors[o + 2] = SMOKE_COLOR.b + (SMOKE_FADE_COLOR.b - SMOKE_COLOR.b) * progress;
  }
}
