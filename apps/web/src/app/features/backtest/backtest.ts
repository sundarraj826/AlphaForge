import { Component, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { DecimalPipe } from '@angular/common';

import { BacktestingService } from '../../core/services/backtesting';
import { StrategyService } from '../../core/services/strategy';
import { MarketHistoryService } from '../../core/services/market-history';

import { BacktestResult } from '../../core/models/backtest-result.model';

@Component({
  selector: 'app-backtest',
  imports: [MatTableModule, MatCardModule, MatFormFieldModule, MatSelectModule, FormsModule, MatInputModule, DecimalPipe],
  templateUrl: './backtest.html',
  styleUrl: './backtest.scss',
})
export class BacktestHome {

  private readonly _backtestingService = inject(BacktestingService);
  readonly strategyService = inject(StrategyService);
  private readonly _marketHistoryService = inject(MarketHistoryService);

  backtestResult: BacktestResult | null = null;
  selectedStrategyId =
    this.strategyService.strategies()[0]?.id ?? '';
  quantity = 1;
  feePercent = 0;
  slippagePercent = 0;
  startDate = '';

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

    this.backtestResult = this._backtestingService.runBacktest(
      strategy,
      candles,
      this.quantity,
      this.feePercent,
      this.slippagePercent
    );
  }
}
