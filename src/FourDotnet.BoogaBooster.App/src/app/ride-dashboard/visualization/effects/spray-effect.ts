import * as THREE from 'three';

import { MAX_SPRAY_PARTICLES, createRng, particleCount } from '../../../effects/effects.models';
import { RideEffectGeometry, SceneEffect, createSoftSpriteTexture } from './scene-effect';

/** Seed for the visual-only RNG (kept apart from the simulation's samplers). */
const SPRAY_SEED = 0x57a47;

const SPRAY_COLOR = 0xbfe3ff;
const SPRAY_DROPLET_SIZE = 0.16;
const GRAVITY = 9.81;
/** Radius of the nozzle ring around the tower, as a multiple of the base half-size. */
const RING_RADIUS_FACTOR = 1.5;
/** Fraction of a nozzle's flight already elapsed when the spray first appears. */
const INITIAL_FLIGHT_SPAN = 0.9;
const OUTWARD_SPEED_MIN = 1.5;
const OUTWARD_SPEED_SPAN = 1.8;
const UPWARD_SPEED_MIN = 3.5;
const UPWARD_SPEED_SPAN = 2.5;
/** Droplets stop at the ground plane. */
const GROUND_Y = 0;

/** Fine water droplets sprayed up and outward from a ring around the base, falling under gravity. */
export class SprayEffect implements SceneEffect {
  private readonly rng = createRng(SPRAY_SEED);
  private readonly positions = new Float32Array(MAX_SPRAY_PARTICLES * 3);
  private readonly velocities = new Float32Array(MAX_SPRAY_PARTICLES * 3);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly texture = createSoftSpriteTexture();
  private readonly material = new THREE.PointsMaterial({
    size: SPRAY_DROPLET_SIZE,
    map: this.texture,
    color: SPRAY_COLOR,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private readonly points = new THREE.Points(this.geometry, this.material);
  private readonly ringRadius: number;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly anchor: RideEffectGeometry,
  ) {
    this.ringRadius = anchor.baseHalfSize * RING_RADIUS_FACTOR;
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.points.frustumCulled = false;
    this.points.visible = false;
    for (let i = 0; i < MAX_SPRAY_PARTICLES; i++) {
      this.launch(i, this.rng() * INITIAL_FLIGHT_SPAN);
    }
    this.scene.add(this.points);
  }

  /**
   * Advances the droplets. `intensity` is 0–100 (0 = off — also used when the
   * weather suppresses spray). Does no work while off.
   */
  update(deltaSeconds: number, intensity: number): void {
    const count = particleCount(MAX_SPRAY_PARTICLES, intensity);
    this.points.visible = count > 0;
    if (count === 0) {
      return;
    }
    this.geometry.setDrawRange(0, count);

    for (let i = 0; i < count; i++) {
      const o = i * 3;
      this.velocities[o + 1] -= GRAVITY * deltaSeconds;
      this.positions[o] += this.velocities[o] * deltaSeconds;
      this.positions[o + 1] += this.velocities[o + 1] * deltaSeconds;
      this.positions[o + 2] += this.velocities[o + 2] * deltaSeconds;
      if (this.positions[o + 1] <= GROUND_Y) {
        this.launch(i, 0);
      }
    }
    this.geometry.attributes['position'].needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  /** Fires droplet `i` from a random nozzle on the ring, fast-forwarded by `flightSeconds`. */
  private launch(i: number, flightSeconds: number): void {
    const angle = this.rng() * Math.PI * 2;
    const outward = OUTWARD_SPEED_MIN + this.rng() * OUTWARD_SPEED_SPAN;
    const upward = UPWARD_SPEED_MIN + this.rng() * UPWARD_SPEED_SPAN;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const t = Math.min(flightSeconds, upward / GRAVITY); // never fast-forward past the apex
    const o = i * 3;
    this.velocities[o] = dx * outward;
    this.velocities[o + 1] = upward - GRAVITY * t;
    this.velocities[o + 2] = dz * outward;
    this.positions[o] = dx * this.ringRadius + dx * outward * t;
    this.positions[o + 1] = this.anchor.baseTopY + upward * t - 0.5 * GRAVITY * t * t;
    this.positions[o + 2] = dz * this.ringRadius + dz * outward * t;
  }
}
