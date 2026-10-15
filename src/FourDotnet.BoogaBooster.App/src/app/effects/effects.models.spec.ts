import { createConditions } from '../weather/testing/fake-weather-source';
import {
  MAX_SMOKE_PARTICLES,
  MAX_STROBE_HZ,
  STROBE_PEAK_LEVEL,
  clampIntensity,
  createRng,
  particleCount,
  smokeDrift,
  sprayBlockedMessage,
  sprayBlockedReason,
  strobeFlashHz,
  strobeLevel,
} from './effects.models';

describe('effects models', () => {
  describe('clampIntensity', () => {
    it('clamps into 0–100 and treats non-finite as 0', () => {
      expect(clampIntensity(-5)).toBe(0);
      expect(clampIntensity(150)).toBe(100);
      expect(clampIntensity(42)).toBe(42);
      expect(clampIntensity(NaN)).toBe(0);
      expect(clampIntensity(Infinity)).toBe(0);
    });
  });

  describe('strobeFlashHz', () => {
    it('never exceeds the 3 Hz cap, even for out-of-range intensities', () => {
      for (const intensity of [-50, 0, 25, 50, 99, 100, 250, 1e9, NaN]) {
        expect(strobeFlashHz(intensity)).toBeLessThanOrEqual(MAX_STROBE_HZ);
      }
      expect(strobeFlashHz(100)).toBe(MAX_STROBE_HZ);
    });

    it('rises with intensity', () => {
      expect(strobeFlashHz(0)).toBeLessThan(strobeFlashHz(50));
      expect(strobeFlashHz(50)).toBeLessThan(strobeFlashHz(100));
    });
  });

  describe('strobeLevel', () => {
    /** Counts rising edges (dark → lit) in a one-second window sampled finely. */
    function flashesInWindow(intensity: number, start: number): number {
      const step = 0.001;
      let flashes = 0;
      let previous = 0;
      for (let i = 0; i < 1000; i++) {
        const level = strobeLevel(start + i * step, intensity);
        if (level > 0 && previous === 0) {
          flashes++;
        }
        previous = level;
      }
      return flashes;
    }

    it('flashes at most 3 times in any one-second window at every intensity', () => {
      for (let intensity = 0; intensity <= 100; intensity += 5) {
        for (const start of [0.0005, 0.13, 0.5, 0.77, 3.3]) {
          expect(flashesInWindow(intensity, start)).toBeLessThanOrEqual(MAX_STROBE_HZ);
        }
      }
    });

    it('is dark at zero intensity and for non-finite time', () => {
      expect(strobeLevel(0.01, 0)).toBe(0);
      expect(strobeLevel(NaN, 80)).toBe(0);
    });

    it('stays within 0–peak, below full white', () => {
      for (let i = 0; i < 200; i++) {
        const level = strobeLevel(i * 0.01, 100);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(STROBE_PEAK_LEVEL);
      }
      expect(STROBE_PEAK_LEVEL).toBeLessThan(1);
    });

    it('scales brightness with intensity', () => {
      expect(strobeLevel(0, 100)).toBeGreaterThan(strobeLevel(0, 10));
    });
  });

  describe('sprayBlockedReason', () => {
    it('allows spray in mild weather and with no data', () => {
      expect(sprayBlockedReason(createConditions({ temperatureCelsius: 15 }))).toBeNull();
      expect(sprayBlockedReason(null)).toBeNull();
    });

    it('blocks at or below freezing', () => {
      expect(sprayBlockedReason(createConditions({ temperatureCelsius: 0 }))).toBe('freezing');
      expect(sprayBlockedReason(createConditions({ temperatureCelsius: -4 }))).toBe('freezing');
    });

    it('blocks in a strong-wind regime', () => {
      expect(
        sprayBlockedReason(createConditions({ temperatureCelsius: 15, regime: 'StrongWind' })),
      ).toBe('strong-wind');
    });

    it('explains each reason', () => {
      expect(sprayBlockedMessage('freezing')).toContain('freezing');
      expect(sprayBlockedMessage('strong-wind')).toContain('strong wind');
    });
  });

  describe('smokeDrift', () => {
    it('is zero with no weather and grows with the wind', () => {
      expect(smokeDrift(null)).toBe(0);
      expect(smokeDrift(0)).toBe(0);
      expect(smokeDrift(7)).toBeGreaterThan(smokeDrift(2));
    });

    it('clamps to the Beaufort scale', () => {
      expect(smokeDrift(99)).toBe(smokeDrift(12));
      expect(smokeDrift(-3)).toBe(0);
    });
  });

  describe('particleCount and createRng', () => {
    it('scales the particle cap by intensity', () => {
      expect(particleCount(MAX_SMOKE_PARTICLES, 0)).toBe(0);
      expect(particleCount(MAX_SMOKE_PARTICLES, 100)).toBe(MAX_SMOKE_PARTICLES);
      expect(particleCount(MAX_SMOKE_PARTICLES, 500)).toBe(MAX_SMOKE_PARTICLES);
    });

    it('produces a repeatable sequence in [0, 1)', () => {
      const a = createRng(7);
      const b = createRng(7);
      for (let i = 0; i < 20; i++) {
        const value = a();
        expect(value).toBe(b());
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });
});
