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
import { ZERODHA_NSE_INTRADAY_COST_PROFILE } from '../../core/services/trading-cost';

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
  readonly _marketHistoryService = inject(MarketHistoryService);

  backtestResult: BacktestResult | null = null;
  validationMessage: string | null = null;
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



  async runBacktest(): Promise<void> {
    // Clear previous results so stale data is not mistaken for a new run.
    this.backtestResult = null;
    this.validationMessage = null;
    this.equityChartData = {
      labels: [],
      datasets: [{ label: 'Equity', data: [], tension: 0.2 }],
    };
    this.drawdownChartData = {
      labels: [],
      datasets: [{ label: 'Drawdown', data: [], tension: 0.2 }],
    };

    const strategy = this.strategyService
      .strategies()
      .find(item => item.id === this.selectedStrategyId);

    if (!strategy) {
      console.error('Select a valid strategy.');
      return;
    }

    if (strategy.market !== 'INDIAN_EQUITY_INTRADAY') {
      this.validationMessage =
        'Backtesting is currently available only for Indian intraday strategies. Forex and other markets are disabled until validated cost models are available.';
      return;
    }

    if (!this.startDate || !this.endDate) {
      console.error('Select both start and end dates.');
      return;
    }

    if (this.startDate > this.endDate) {
      console.error('Start date must not be after end date.');
      return;
    }

    await this._marketHistoryService.loadCandles({
      source: 'upstox',
      fromDate: this.formatDate(this.startDate),
      toDate: this.formatDate(this.endDate),
    });

    // Check the error before reading the candles.
    if (this._marketHistoryService.error()) {
      console.error(this._marketHistoryService.error());
      return;
    }

    const candles = this._marketHistoryService.getCandles();

    if (candles.length === 0) {
      console.error('No historical candles available.');
      return;
    }

    const startTimestamp = new Date(
      `${this.formatDate(this.startDate)}T00:00:00`,
    ).getTime();

    const endTimestamp = new Date(
      `${this.formatDate(this.endDate)}T23:59:59.999`,
    ).getTime();

    this.backtestResult = this._backtestingService.runBacktest(
      strategy,
      candles,
      this.quantity,
      this.initialCapital,
      this.slippagePercent,
      startTimestamp,
      endTimestamp,
      0,
      ZERODHA_NSE_INTRADAY_COST_PROFILE,
    );

    this.equityChartData = {
      labels: this.backtestResult.equityCurve.map((_, index) => index),
      datasets: [{
        label: 'Equity',
        data: this.backtestResult.equityCurve,
        tension: 0.2,
      }],
    };

    this.drawdownChartData = {
      labels: this.backtestResult.drawdownCurve.map((_, index) => index),
      datasets: [{
        label: 'Drawdown',
        data: this.backtestResult.drawdownCurve,
        tension: 0.2,
      }],
    };
  }



  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
