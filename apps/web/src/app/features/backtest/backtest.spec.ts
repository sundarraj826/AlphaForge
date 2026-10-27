import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { BacktestHome } from './backtest';
import { BacktestingService } from '../../core/services/backtesting';
import { StrategyService } from '../../core/services/strategy';
import { MarketHistoryService } from '../../core/services/market-history';
import { ZERODHA_NSE_INTRADAY_COST_PROFILE } from '../../core/services/trading-cost';
import { Strategy } from '../../core/models/strategy.model';
import { MarketCandle } from '../../core/models/market-candle.model';
import { BacktestResult } from '../../core/models/backtest-result.model';

describe('Backtest', () => {
  let component: BacktestHome;
  let fixture: ComponentFixture<BacktestHome>;
  let backtestingService: { runBacktest: ReturnType<typeof vi.fn> };
  let marketHistoryService: {
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    source: ReturnType<typeof signal<'mock' | 'upstox' | null>>;
    loadCandles: ReturnType<typeof vi.fn>;
    getCandles: ReturnType<typeof vi.fn>;
  };
  let strategies: ReturnType<typeof signal<Strategy[]>>;
  const indianStrategy: Strategy = {
    id: 'indian-strategy',
    name: 'Indian Intraday',
    instrument: 'NIFTY50',
    market: 'INDIAN_EQUITY_INTRADAY',
    timeframe: '15m',
    status: 'Active',
  };
  const candles: MarketCandle[] = [{
    timestamp: new Date('2026-01-01T12:00:00').getTime(),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
  }];
  const result: BacktestResult = {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0,
    totalProfitLoss: 0,
    totalFees: 0,
    initialCapital: 100000,
    finalCapital: 100000,
    openPosition: null,
    equityCurve: [100000],
    drawdownCurve: [0],
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    trades: [],
  };

  beforeEach(async () => {
    backtestingService = {
      runBacktest: vi.fn(() => result),
    };
    marketHistoryService = {
      loading: signal(false),
      error: signal<string | null>(null),
      source: signal<'mock' | 'upstox' | null>(null),
      loadCandles: vi.fn(async () => undefined),
      getCandles: vi.fn(() => candles),
    };
    strategies = signal([indianStrategy]);

    await TestBed.configureTestingModule({
      imports: [BacktestHome],
      providers: [
        { provide: BacktestingService, useValue: backtestingService },
        {
          provide: StrategyService,
          useValue: { strategies: strategies.asReadonly() },
        },
        { provide: MarketHistoryService, useValue: marketHistoryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BacktestHome);
    component = fixture.componentInstance;
    component.startDate = new Date('2026-01-01T00:00:00');
    component.endDate = new Date('2026-01-01T00:00:00');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('runs an Indian intraday backtest with the named cost profile', async () => {
    await component.runBacktest();

    expect(marketHistoryService.loadCandles).toHaveBeenCalledWith({
      source: 'upstox',
      instrument: 'NIFTY50',
      timeframe: '15m',
      fromDate: '2026-01-01',
      toDate: '2026-01-01',
    });
    expect(backtestingService.runBacktest).toHaveBeenCalledWith(
      indianStrategy,
      candles,
      1,
      100000,
      0,
      new Date('2026-01-01T00:00:00').getTime(),
      new Date('2026-01-01T23:59:59.999').getTime(),
      0,
      ZERODHA_NSE_INTRADAY_COST_PROFILE,
    );
    expect(component.backtestResult).toBe(result);
    expect(component.validationMessage).toBeNull();
  });

  it('displays historical API errors and does not run the backtest', async () => {
    marketHistoryService.loadCandles.mockImplementation(async () => {
      marketHistoryService.error.set(
        'The selected timeframe supports up to 1 month of Upstox historical data.',
      );
    });

    await component.runBacktest();
    fixture.detectChanges();

    expect(component.validationMessage).toContain(
      'supports up to 1 month of Upstox historical data',
    );
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('supports up to 1 month');
    expect(backtestingService.runBacktest).not.toHaveBeenCalled();
  });

  it('displays feedback when no historical candles are returned', async () => {
    marketHistoryService.getCandles.mockReturnValue([]);

    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[mat-raised-button]').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.validationMessage).toBe(
      'No historical candles were found for the selected instrument, timeframe, and date range. Please check your selection.',
    );
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('No historical candles were found');
    expect(backtestingService.runBacktest).not.toHaveBeenCalled();
  });

  it.each(['FOREX', 'CRYPTO', 'INDIAN_EQUITY_DELIVERY'] as const)(
    'rejects a selected %s strategy before loading historical data',
    async market => {
      const unsupportedStrategy: Strategy = {
        ...indianStrategy,
        market,
      };
      strategies.set([unsupportedStrategy]);

      await component.runBacktest();
      fixture.detectChanges();

      expect(component.validationMessage).toContain(
        'only for Indian intraday strategies',
      );
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
        .toContain('Forex and other markets are disabled');
      expect(marketHistoryService.loadCandles).not.toHaveBeenCalled();
      expect(backtestingService.runBacktest).not.toHaveBeenCalled();
    },
  );
});
