import * as THREE from 'three';

/** Where on the ride the effects attach (metres), derived from the ride geometry. */
export interface RideEffectGeometry {
  /** Half the side length of the square base plate. */
  readonly baseHalfSize: number;
  /** Height of the top of the base plate above the ground. */
  readonly baseTopY: number;
  /** Height of the arm plane above the ground. */
  readonly armHeightY: number;
}

/** A self-contained, disposable part of the effects scene. */
export interface SceneEffect {
  /** Removes the effect from the scene and releases its GPU resources. */
  dispose(): void;
}

/** Diameter, in pixels, of the generated soft-edged particle sprite. */
const SPRITE_SIZE = 64;

/** Builds a white, radially fading dot used as the sprite for point particles. */
export function createSoftSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const context = canvas.getContext('2d');
  if (context) {
    const half = SPRITE_SIZE / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }
  return new THREE.CanvasTexture(canvas);
}
