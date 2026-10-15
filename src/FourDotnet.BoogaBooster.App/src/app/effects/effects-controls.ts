import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { EffectControl } from './effect-control/effect-control';
import { EffectsStateService } from './effects-state.service';
import { MAX_STROBE_HZ, sprayBlockedMessage } from './effects.models';

/**
 * Left-rail "Effects" group: switches and intensity for the smoke, water-spray
 * and stroboscope effects. A thin container — state lives in
 * {@link EffectsStateService} and each row is an {@link EffectControl}. Effects are
 * presentational only, so the controls stay available in every ride state.
 */
@Component({
  selector: 'bb-effects-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EffectControl],
  template: `
    <section class="effects" aria-labelledby="effects-heading">
      <h2 id="effects-heading">Effects</h2>

      <bb-effect-control
        id="effect-smoke"
        label="Smoke"
        [enabled]="effects.smoke().enabled"
        [intensity]="effects.smoke().intensity"
        (enabledChange)="effects.setEnabled('smoke', $event)"
        (intensityChange)="effects.setIntensity('smoke', $event)"
      />

      <bb-effect-control
        id="effect-spray"
        label="Water spray"
        [enabled]="effects.spray().enabled"
        [intensity]="effects.spray().intensity"
        (enabledChange)="effects.setEnabled('spray', $event)"
        (intensityChange)="effects.setIntensity('spray', $event)"
      >
        @if (sprayMessage(); as message) {
          <p class="note" role="status">{{ message }}</p>
        }
      </bb-effect-control>

      <bb-effect-control
        id="effect-strobe"
        label="Stroboscope"
        [enabled]="effects.strobe().enabled"
        [intensity]="effects.strobe().intensity"
        [disabled]="effects.reducedMotion()"
        (enabledChange)="effects.setEnabled('strobe', $event)"
        (intensityChange)="effects.setIntensity('strobe', $event)"
      >
        <p class="note warning">
          Photosensitivity warning: flashing light, up to {{ maxStrobeHz }} flashes per second. It
          may trigger seizures in people with photosensitive epilepsy.
        </p>
        @if (effects.reducedMotion()) {
          <p class="note" role="status">
            The stroboscope is unavailable because your system prefers reduced motion.
          </p>
        }
      </bb-effect-control>
    </section>
  `,
  styles: `
    .effects {
      display: grid;
      gap: 1.25rem;
    }
    h2 {
      margin: 0;
      font-size: 1rem;
    }
    .note {
      margin: 0;
      font-size: 0.85rem;
      color: var(--bb-muted);
    }
    .warning {
      color: var(--bb-alert);
    }
  `,
})
export class EffectsControls {
  protected readonly effects = inject(EffectsStateService);
  protected readonly maxStrobeHz = MAX_STROBE_HZ;

  /** Why spray is currently unavailable, as text; `null` when it is available. */
  protected readonly sprayMessage = computed(() => {
    const reason = this.effects.sprayBlockedReason();
    return reason === null ? null : sprayBlockedMessage(reason);
  });
}
