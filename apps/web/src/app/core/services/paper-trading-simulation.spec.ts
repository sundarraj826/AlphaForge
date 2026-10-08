import { TestBed } from '@angular/core/testing';

import { PaperTradingSimulationService } from './paper-trading-simulation';
import { PaperTradingRunnerService } from './paper-trading-runner';
import { PaperTradingService } from './paper-trading';
import { StrategyService } from './strategy';
import { IndicatorService } from './indicators';
import { MarketCandle } from '../models/market-candle.model';
import { Strategy } from '../models/strategy.model';

describe('PaperTradingSimulationService', () => {
  let service: PaperTradingSimulationService;
  let paperTradingService: PaperTradingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PaperTradingSimulationService,
        PaperTradingRunnerService,
        PaperTradingService,
        StrategyService,
        IndicatorService
      ]
    });

    service = TestBed.inject(PaperTradingSimulationService);
    paperTradingService = TestBed.inject(PaperTradingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should process candles through the paper trading runner', () => {
    const strategy: Strategy = {
      id: 'test-strategy',
      name: 'Test Strategy',
      instrument: 'TEST',
      timeframe: '1m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 99
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '<',
          value: 100
        }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 4,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      },
      {
        timestamp: 2,
        open: 105,
        high: 108,
        low: 105,
        close: 108,
        volume: 1000
      }
    ];

    service.run(strategy, candles);

    expect(paperTradingService.positions).toHaveLength(1);
    expect(paperTradingService.positions[0].quantity).toBe(476);
    expect(paperTradingService.positions[0].currentPrice).toBe(108);
    expect(
      paperTradingService.positions[0].unrealizedProfitLoss
    ).toBe(1428);
  });

  it('should close the paper position when the strategy returns SELL', () => {
    const strategy: Strategy = {
      id: 'sell-test-strategy',
      name: 'Sell Test Strategy',
      instrument: 'TEST',
      timeframe: '1m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 99
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '<',
          value: 100
        }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 4,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      },
      {
        timestamp: 2,
        open: 105,
        high: 110,
        low: 100,
        close: 110,
        volume: 1000
      },
    ];

    const result = service.run(strategy, candles);

    expect(paperTradingService.positions).toHaveLength(0);
    expect(paperTradingService.capital).toBe(102380);

    expect(result.initialCapital).toBe(100000);
    expect(result.finalCapital).toBe(102380);
    expect(result.totalProfitLoss).toBe(2380);
    expect(result.totalTrades).toBe(1);
    expect(result.winningTrades).toBe(1);
    expect(result.losingTrades).toBe(0);
    expect(result.winRate).toBe(100);
  });

  it('should track a losing paper trade correctly', () => {
    const strategy: Strategy = {
      id: 'losing-trade-strategy',
      name: 'Losing Trade Strategy',
      instrument: 'TEST',
      timeframe: '1m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 99
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '<',
          value: 111
        }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 4,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      },
      {
        timestamp: 2,
        open: 105,
        high: 108,
        low: 90,
        close: 100,
        volume: 1000
      }
    ];

    const result = service.run(strategy, candles);

    expect(paperTradingService.positions).toHaveLength(0);

    expect(result.totalTrades).toBe(1);
    expect(result.winningTrades).toBe(0);
    expect(result.losingTrades).toBe(1);
    expect(result.winRate).toBe(0);

    expect(result.totalProfitLoss).toBe(-2380);
    expect(result.finalCapital).toBe(97620);
  });
});