import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Slider } from 'primeng/slider';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { MAX_INTENSITY, MIN_INTENSITY, clampIntensity } from '../effects.models';

/**
 * One effect row: a labelled on/off switch and an intensity slider. Purely
 * presentational — it renders the values it is given and reports changes through
 * outputs. Any explanatory notes (warnings, unavailability) are projected in.
 */
@Component({
  selector: 'bb-effect-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ToggleSwitch, Slider],
  template: `
    <div class="effect" [formGroup]="form">
      <div class="row">
        <label class="name" [for]="id() + '-toggle'">{{ label() }}</label>
        <p-toggleswitch formControlName="enabled" [inputId]="id() + '-toggle'" />
      </div>
      <div class="row">
        <span class="sub" [id]="id() + '-intensity-label'">{{ label() }} intensity</span>
        <output>{{ intensity() }}%</output>
      </div>
      <p-slider
        formControlName="intensity"
        [min]="min"
        [max]="max"
        [step]="1"
        [ariaLabelledBy]="id() + '-intensity-label'"
      />
      <ng-content />
    </div>
  `,
  styles: `
    .effect {
      display: grid;
      gap: 0.5rem;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }
    .name {
      font-weight: 600;
    }
    .sub {
      font-size: 0.85rem;
      color: var(--bb-muted);
    }
    output {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    p-slider {
      margin: 0.25rem 0.5rem;
    }
  `,
})
export class EffectControl {
  /** Unique id prefix for the control's elements. */
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly enabled = input.required<boolean>();
  readonly intensity = input.required<number>();
  /** Locks the whole row (switch and slider). */
  readonly disabled = input(false);

  readonly enabledChange = output<boolean>();
  readonly intensityChange = output<number>();

  protected readonly min = MIN_INTENSITY;
  protected readonly max = MAX_INTENSITY;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    enabled: false,
    intensity: MIN_INTENSITY,
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.form.controls.enabled.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.enabledChange.emit(value));
    this.form.controls.intensity.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.intensityChange.emit(clampIntensity(Number(value))));

    // Mirror the inputs into the form without echoing them back out.
    effect(() => {
      this.form.patchValue(
        { enabled: this.enabled(), intensity: this.intensity() },
        { emitEvent: false },
      );
    });
    effect(() => {
      if (this.disabled()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }
}
