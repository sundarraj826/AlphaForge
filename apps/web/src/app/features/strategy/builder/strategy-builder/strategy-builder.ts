import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { INSTRUMENTS } from '../../../../core/constants/instruments';
import { TIMEFRAMES } from '../../../../core/constants/timeframes';
import { INDICATORS } from '../../../../core/constants/indicators';
import { OPERATORS } from '../../../../core/constants/operators';


import { Strategy } from '../../../../core/models/strategy.model';
import { Indicator, Operator } from '../../../../core/types/trading-rule.types';

@Component({
  selector: 'app-strategy-builder',
  imports: [MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, ReactiveFormsModule, MatSlideToggleModule],
  templateUrl: './strategy-builder.html',
  styleUrl: './strategy-builder.scss',
})
export class StrategyBuilder {

  private readonly _fb = inject(FormBuilder);
  readonly instruments = INSTRUMENTS;
  readonly timeframes = TIMEFRAMES;
  readonly indicators = INDICATORS;
  readonly operators = OPERATORS;



  readonly strategyForm = this._fb.nonNullable.group({
    name: ['', Validators.required],
    instrument: ['', Validators.required],
    timeframe: ['', Validators.required],
    status: [true],

    entryConditions: this._fb.array([
      this.createEntryCondition()
    ]),

    exitConditions: this._fb.array([
      this.createExitCondition()
    ]),

    riskManagement: this._fb.nonNullable.group({
      riskPerTrade: [1],
      stopLossPercent: [1],
      takeProfitPercent: [2],
      maxDailyLossPercent: [3],
      maxOpenTrades: [3]
    }),
  });

  createEntryCondition() {
    return this._fb.nonNullable.group({
      indicator: ['', Validators.required],
      operator: ['', Validators.required],
      value: ['', Validators.required]
    });
  }

  createExitCondition() {
    return this._fb.nonNullable.group({
      indicator: ['', Validators.required],
      operator: ['', Validators.required],
      value: ['', Validators.required]
    });
  }

  get entryConditions(): FormArray {
    return this.strategyForm.controls.entryConditions;
  }


  get exitConditions(): FormArray {
    return this.strategyForm.controls.exitConditions;
  }

  // Entry Conditions
  addEntryCondition(): void {
    this.entryConditions.push(this.createEntryCondition());
  }

  removeEntryCondition(index: number): void {
    this.entryConditions.removeAt(index);
  }

  // Exit Conditions
  addExitCondition(): void {
    this.exitConditions.push(this.createExitCondition());
  }

  removeExitCondition(index: number): void {
    this.exitConditions.removeAt(index);
  }

  onSubmit() {
    if (this.strategyForm.invalid) {
      this.strategyForm.markAllAsTouched();
      return;
    }
    const formValue = this.strategyForm.getRawValue();

    const strategy: Strategy = {
      id: '',
      name: formValue.name,
      instrument: formValue.instrument,
      timeframe: formValue.timeframe,
      status: formValue.status ? 'Active' : 'Inactive',

      entryConditions: formValue.entryConditions.map(condition => ({
        indicator: condition.indicator as Indicator,
        operator: condition.operator as Operator,
        value: condition.value
      })),

      exitConditions: formValue.exitConditions.map(condition => ({
        indicator: condition.indicator as Indicator,
        operator: condition.operator as Operator,
        value: condition.value
      })),
      riskManagement: formValue.riskManagement
    }
    console.log('Form value:', strategy);
  }
}
