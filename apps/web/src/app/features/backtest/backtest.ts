import { Component, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

import { DecimalPipe } from '@angular/common';

import { BacktestingService } from '../../core/services/backtesting';
import { StrategyService } from '../../core/services/strategy';
import { MarketHistoryService } from '../../core/services/market-history';

import { BacktestResult } from '../../core/models/backtest-result.model';

@Component({
  selector: 'app-backtest',
  imports: [
    MatTableModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    MatInputModule,
    DecimalPipe,
    MatDatepickerModule,
    MatNativeDateModule,
    BaseChartDirective
  ],
  templateUrl: './backtest.html',
  styleUrl: './backtest.scss',
})
export class BacktestHome {

  private readonly _backtestingService = inject(BacktestingService);
  readonly strategyService = inject(StrategyService);
  private readonly _marketHistoryService = inject(MarketHistoryService);

  backtestResult: BacktestResult | null = null;
  equityChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Equity',
        data: [],
        tension: 0.2
      }
    ]
  };

  equityChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false
  };
  drawdownChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Drawdown',
        data: [],
        tension: 0.2
      }
    ]
  };

  drawdownChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false
  };

  selectedStrategyId =
    this.strategyService.strategies()[0]?.id ?? '';
  quantity = 1;
  initialCapital = 100000;
  feePercent = 0;
  slippagePercent = 0;
  startDate: Date | null = null;
  endDate: Date | null = null;

  displayedColumns: string[] = [
    'entryPrice',
    'exitPrice',
    'quantity',
    'profitLoss'
  ];

  runBacktest(): void {
    const strategy = this.strategyService
      .strategies()
      .find(strategy => strategy.id === this.selectedStrategyId);

    if (!strategy) {
      return;
    }

    const candles = this._marketHistoryService.getCandles();

    const startTimestamp = this.startDate?.getTime();
    const endTimestamp = this.endDate?.getTime();

    this.backtestResult = this._backtestingService.runBacktest(
      strategy,
      candles,
      this.quantity,
      this.initialCapital,
      this.feePercent,
      this.slippagePercent,
      startTimestamp,
      endTimestamp
    );

    this.equityChartData = {
      labels: this.backtestResult.equityCurve.map((_, index) => index),
      datasets: [
        {
          label: 'Equity',
          data: this.backtestResult.equityCurve,
          tension: 0.2
        }
      ]
    };

    this.drawdownChartData = {
      labels: this.backtestResult.drawdownCurve.map((_, index) => index),
      datasets: [
        {
          label: 'Drawdown',
          data: this.backtestResult.drawdownCurve,
          tension: 0.2
        }
      ]
    };

  }
}
