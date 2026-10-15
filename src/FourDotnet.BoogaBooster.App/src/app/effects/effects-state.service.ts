import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import { WeatherStateService } from '../weather/state/weather-state.service';
import {
  DEFAULT_INTENSITY,
  MIN_INTENSITY,
  SprayBlockedReason,
  clampIntensity,
  sprayBlockedReason,
} from './effects.models';

/** The three switchable effects. */
export type EffectKey = 'smoke' | 'spray' | 'strobe';

/** One effect's operator setting. */
export interface EffectSetting {
  readonly enabled: boolean;
  /** Percent, 0–100. */
  readonly intensity: number;
}

/** The complete, immutable effects state. */
export interface EffectsState {
  readonly smoke: EffectSetting;
  readonly spray: EffectSetting;
  readonly strobe: EffectSetting;
}

/**
 * Intensity (0–100) each effect should render at right now; `0` means the
 * effect is off, whether switched off, suppressed or locked out.
 */
export interface EffectLevels {
  readonly smoke: number;
  readonly spray: number;
  readonly strobe: number;
}

/** Levels with every effect off. */
export const NO_EFFECTS: EffectLevels = { smoke: 0, spray: 0, strobe: 0 };

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const OFF: EffectSetting = { enabled: false, intensity: DEFAULT_INTENSITY };

/** Every effect off at the default intensity. Never persisted, so this is also the state after a reload. */
export const INITIAL_EFFECTS_STATE: EffectsState = { smoke: OFF, spray: OFF, strobe: OFF };

/**
 * Client-side, presentational state of the visual effects. Effects never touch
 * ride physics or telemetry. All effects start off and nothing is persisted, so
 * the photosensitivity-sensitive strobe can never come back on after a reload.
 */
@Injectable({ providedIn: 'root' })
export class EffectsStateService {
  private readonly weather = inject(WeatherStateService);
  private readonly stateSignal = signal<EffectsState>(INITIAL_EFFECTS_STATE);
  private readonly reducedMotionSignal = signal(false);

  /** The current (readonly) operator settings. */
  readonly state = this.stateSignal.asReadonly();

  readonly smoke = computed(() => this.stateSignal().smoke);
  readonly spray = computed(() => this.stateSignal().spray);
  readonly strobe = computed(() => this.stateSignal().strobe);

  /** Whether the user's system asks for reduced motion. */
  readonly reducedMotion = this.reducedMotionSignal.asReadonly();

  /** Why spray cannot currently be shown, or `null`. */
  readonly sprayBlockedReason = computed<SprayBlockedReason | null>(() =>
    sprayBlockedReason(this.weather.conditions()),
  );

  /** Effective levels after weather suppression and the reduced-motion lockout. */
  readonly levels = computed<EffectLevels>(() => {
    const { smoke, spray, strobe } = this.stateSignal();
    return {
      smoke: smoke.enabled ? smoke.intensity : MIN_INTENSITY,
      spray: spray.enabled && this.sprayBlockedReason() === null ? spray.intensity : MIN_INTENSITY,
      strobe: strobe.enabled && !this.reducedMotionSignal() ? strobe.intensity : MIN_INTENSITY,
    };
  });

  constructor() {
    const query = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION_QUERY) : null;
    if (query) {
      this.reducedMotionSignal.set(query.matches);
      const onChange = (event: MediaQueryListEvent) => this.reducedMotionSignal.set(event.matches);
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }
  }

  /** Switches an effect on or off. The strobe cannot be switched on while reduced motion is preferred. */
  setEnabled(effect: EffectKey, enabled: boolean): void {
    if (effect === 'strobe' && enabled && this.reducedMotionSignal()) {
      return;
    }
    this.replace(effect, { enabled });
  }

  /** Sets an effect's intensity, clamped to 0–100. */
  setIntensity(effect: EffectKey, intensity: number): void {
    this.replace(effect, { intensity: clampIntensity(intensity) });
  }

  private replace(effect: EffectKey, change: Partial<EffectSetting>): void {
    this.stateSignal.update((state) => ({ ...state, [effect]: { ...state[effect], ...change } }));
  }
}
