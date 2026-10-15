import { WeatherConditions } from '../weather/models/weather.models';

/**
 * Pure model for the ride's visual effects (smoke, water spray, stroboscope).
 * Everything here is presentational and side-effect free so the safety-critical
 * strobe cadence can be unit-tested without WebGL.
 */

/** Lowest allowed intensity, in percent. */
export const MIN_INTENSITY = 0;

/** Highest allowed intensity, in percent. */
export const MAX_INTENSITY = 100;

/** Default intensity applied to an effect, in percent. */
export const DEFAULT_INTENSITY = 50;

/**
 * Hard photosensitivity limit: the strobe never flashes more than this many
 * times per second at any intensity (WCAG 2.3.1 — three flashes threshold).
 */
export const MAX_STROBE_HZ = 3;

/** Flash rate at 0 % intensity. */
export const MIN_STROBE_HZ = 0.5;

/** Fraction of each flash period during which the strobe is lit. */
export const STROBE_DUTY = 0.2;

/** Brightest flash level (0–1); kept below full white to soften the contrast. */
export const STROBE_PEAK_LEVEL = 0.85;

/** Dimmest flash level (0–1) reached at the lowest non-zero intensity. */
export const STROBE_MIN_LEVEL = 0.3;

/** Maximum number of smoke particles at 100 % intensity. */
export const MAX_SMOKE_PARTICLES = 400;

/** Maximum number of spray droplets at 100 % intensity. */
export const MAX_SPRAY_PARTICLES = 900;

/** Horizontal smoke drift added per Beaufort step, in metres per second. */
export const SMOKE_DRIFT_PER_BEAUFORT = 0.45;

/** Highest Beaufort number considered for drift. */
export const MAX_BEAUFORT = 12;

/** At or below this temperature (°C) water spray is suppressed. */
export const FREEZING_CELSIUS = 0;

/** Why water spray cannot currently be shown. */
export type SprayBlockedReason = 'freezing' | 'strong-wind';

/** Clamps an intensity into 0–100; non-finite values become 0. */
export function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_INTENSITY;
  }
  return Math.min(Math.max(value, MIN_INTENSITY), MAX_INTENSITY);
}

/**
 * Flash rate (Hz) for an intensity: linear from {@link MIN_STROBE_HZ} to
 * {@link MAX_STROBE_HZ}, and hard-capped at {@link MAX_STROBE_HZ}.
 */
export function strobeFlashHz(intensity: number): number {
  const fraction = clampIntensity(intensity) / MAX_INTENSITY;
  const hz = MIN_STROBE_HZ + (MAX_STROBE_HZ - MIN_STROBE_HZ) * fraction;
  return Math.min(hz, MAX_STROBE_HZ);
}

/**
 * Strobe brightness (0–1) at a point in time: a square pulse lit for
 * {@link STROBE_DUTY} of every period. The peak scales with intensity but never
 * exceeds {@link STROBE_PEAK_LEVEL}. Zero intensity (or a non-finite time) is dark.
 */
export function strobeLevel(timeSeconds: number, intensity: number): number {
  const clamped = clampIntensity(intensity);
  if (clamped === MIN_INTENSITY || !Number.isFinite(timeSeconds)) {
    return 0;
  }
  const period = 1 / strobeFlashHz(clamped);
  const phase = (((timeSeconds % period) + period) % period) / period;
  if (phase >= STROBE_DUTY) {
    return 0;
  }
  const fraction = clamped / MAX_INTENSITY;
  return Math.min(
    STROBE_MIN_LEVEL + (STROBE_PEAK_LEVEL - STROBE_MIN_LEVEL) * fraction,
    STROBE_PEAK_LEVEL,
  );
}

/** Why spray is unavailable for the given weather, or `null` when it is allowed. */
export function sprayBlockedReason(
  conditions: WeatherConditions | null,
): SprayBlockedReason | null {
  if (!conditions) {
    return null;
  }
  if (conditions.temperatureCelsius <= FREEZING_CELSIUS) {
    return 'freezing';
  }
  if (conditions.regime === 'StrongWind') {
    return 'strong-wind';
  }
  return null;
}

/** Operator-facing explanation for a blocked spray. */
export function sprayBlockedMessage(reason: SprayBlockedReason): string {
  return reason === 'freezing'
    ? 'Water spray is unavailable because of freezing temperatures.'
    : 'Water spray is unavailable because of strong wind.';
}

/** Downwind smoke drift speed (m/s) for a Beaufort number; `null` means no data. */
export function smokeDrift(beaufort: number | null): number {
  if (beaufort === null || !Number.isFinite(beaufort)) {
    return 0;
  }
  return Math.min(Math.max(beaufort, 0), MAX_BEAUFORT) * SMOKE_DRIFT_PER_BEAUFORT;
}

/** Number of particles to draw for a cap and an intensity. */
export function particleCount(cap: number, intensity: number): number {
  return Math.round((cap * clampIntensity(intensity)) / MAX_INTENSITY);
}

/** Small seeded PRNG (mulberry32) so visual randomness is repeatable and separate from the simulation. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
