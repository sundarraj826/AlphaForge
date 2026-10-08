import { TestBed } from '@angular/core/testing';
import { StrategyService } from './strategy';
import { IndicatorService } from './indicators';
import { MarketCandle } from '../models/market-candle.model';
import { EntryCondition } from '../models/entry-condition.model';
import { ExitCondition } from '../models/exit-condition.model';
import { Strategy } from '../models/strategy.model';

describe('StrategyService', () => {
  let service: StrategyService;
  let indicatorService: IndicatorService;

  const candles: MarketCandle[] = [
    {
      timestamp: 1,
      open: 100,
      high: 103,
      low: 99,
      close: 100,
      volume: 1000
    },
    {
      timestamp: 2,
      open: 100,
      high: 104,
      low: 99,
      close: 102,
      volume: 1200
    },
    {
      timestamp: 3,
      open: 102,
      high: 103,
      low: 100,
      close: 101,
      volume: 1100
    }
  ];

  const intradayStrategy: Strategy = {
    id: 'intraday-test',
    name: 'NIFTY Intraday Trend',
    instrument: 'NIFTY50',
    timeframe: '15m',
    status: 'Active',
    type: 'INTRADAY',
    riskManagement: {
      riskPerTrade: 0.5,
      stopLossPercent: 0,
      takeProfitPercent: 0,
      maxDailyLossPercent: 1.5,
      maxOpenTrades: 1,
      emaFastPeriod: 20,
      emaSlowPeriod: 50,
      volumePeriod: 20,
      volumeMultiplier: 1.2,
      atrPeriod: 14,
      atrMultiplier: 1.5,
      rewardRiskRatio: 2
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StrategyService, IndicatorService]
    });

    service = TestBed.inject(StrategyService);
    indicatorService = TestBed.inject(IndicatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return BUY when price is above EMA', () => {
    vi.spyOn(indicatorService, 'calculateLatestEma')
      .mockReturnValue(100);

    const result = service.evaluatePriceVsEma(candles, 3);

    expect(result).toBe('BUY');
  });

  it('should return SELL when price is below EMA', () => {
    vi.spyOn(indicatorService, 'calculateLatestEma')
      .mockReturnValue(105);

    const result = service.evaluatePriceVsEma(candles, 3);

    expect(result).toBe('SELL');
  });

  it('should return WAIT when price equals EMA', () => {
    vi.spyOn(indicatorService, 'calculateLatestEma')
      .mockReturnValue(101);

    const result = service.evaluatePriceVsEma(candles, 3);

    expect(result).toBe('WAIT');
  });

  it('should return WAIT when EMA is not available', () => {
    vi.spyOn(indicatorService, 'calculateLatestEma')
      .mockReturnValue(null);

    const result = service.evaluatePriceVsEma(candles, 3);

    expect(result).toBe('WAIT');
  });

  it('should return true when Price is greater than the condition value', () => {
    const condition: EntryCondition = {
      indicator: 'Price',
      operator: '>',
      value: 105
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    expect(
      service.evaluateEntryCondition(condition, candles)
    ).toBe(true);
  });

  it('should return true when Price is less than the condition value', () => {
    const condition: EntryCondition = {
      indicator: 'Price',
      operator: '<',
      value: 110
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    expect(
      service.evaluateEntryCondition(condition, candles)
    ).toBe(true);
  });

  it('should return false when there are no candles', () => {
    const condition: EntryCondition = {
      indicator: 'Price',
      operator: '>',
      value: 100
    };

    expect(
      service.evaluateEntryCondition(condition, [])
    ).toBe(false);
  });

  it('should return true when Price is above EMA', () => {
    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(105);

    const condition: EntryCondition = {
      indicator: 'EMA',
      operator: '>',
      value: 3
    };

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateEntryCondition(
      condition,
      testCandles
    );

    expect(result).toBe(true);
  });

  it('should return true when Price is below EMA', () => {
    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(110);

    const condition: EntryCondition = {
      indicator: 'EMA',
      operator: '<',
      value: 3
    };

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateEntryCondition(
      condition,
      testCandles
    );

    expect(result).toBe(true);
  });

  it('should return true when all entry conditions are satisfied', () => {
    const conditions: EntryCondition[] = [
      {
        indicator: 'Price',
        operator: '>',
        value: 100
      },
      {
        indicator: 'EMA',
        operator: '>',
        value: 3
      }
    ];

    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(105);

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateEntryConditions(
      conditions,
      testCandles
    );

    expect(result).toBe(true);
  });

  it('should return false when any entry condition fails', () => {
    const conditions: EntryCondition[] = [
      {
        indicator: 'Price',
        operator: '>',
        value: 100
      },
      {
        indicator: 'EMA',
        operator: '<',
        value: 3
      }
    ];

    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(100);

    const result = service.evaluateEntryConditions(
      conditions,
      candles
    );

    expect(result).toBe(false);
  });
  it('should return false when there are no entry conditions', () => {
    const result = service.evaluateEntryConditions([], candles);

    expect(result).toBe(false);
  });

  it('should return BUY when all strategy entry conditions are satisfied', () => {
    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(105);

    const strategy: Strategy = {
      id: '1',
      name: 'Test Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 100
        },
        {
          indicator: 'EMA',
          operator: '>',
          value: 3
        }
      ]
    };

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateStrategy(
      strategy,
      testCandles,
      'NONE'
    );

    expect(result).toBe('BUY');
  });

  it('should return WAIT when a strategy entry condition fails', () => {
    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(110);

    const strategy: Strategy = {
      id: '1',
      name: 'Test Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 100
        },
        {
          indicator: 'EMA',
          operator: '>',
          value: 3
        }
      ]
    };

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateStrategy(
      strategy,
      testCandles,
      'NONE'
    );

    expect(result).toBe('WAIT');
  });

  it('should return WAIT when strategy has no entry conditions', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Test Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active'
    };

    const result = service.evaluateStrategy(
      strategy,
      candles,
      'NONE'
    );

    expect(result).toBe('WAIT');
  });

  it('should return true when Exit Price is greater than the condition value', () => {
    const condition: ExitCondition = {
      indicator: 'Price',
      operator: '>',
      value: 105
    };

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateExitCondition(
      condition,
      testCandles
    );

    expect(result).toBe(true);
  });

  it('should return true when Exit Price is less than the condition value', () => {
    const condition: ExitCondition = {
      indicator: 'Price',
      operator: '<',
      value: 110
    };

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateExitCondition(
      condition,
      testCandles
    );

    expect(result).toBe(true);
  });

  it('should return false when there are no candles for exit condition', () => {
    const condition: ExitCondition = {
      indicator: 'Price',
      operator: '>',
      value: 100
    };

    const result = service.evaluateExitCondition(
      condition,
      []
    );

    expect(result).toBe(false);
  });

  it('should return true when all exit conditions are satisfied', () => {
    const conditions: ExitCondition[] = [
      {
        indicator: 'Price',
        operator: '>',
        value: 100
      },
      {
        indicator: 'EMA',
        operator: '>',
        value: 3
      }
    ];

    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(105);

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateExitConditions(
      conditions,
      testCandles
    );

    expect(result).toBe(true);
  });

  it('should return false when any exit condition fails', () => {
    const conditions: ExitCondition[] = [
      {
        indicator: 'Price',
        operator: '>',
        value: 100
      },
      {
        indicator: 'EMA',
        operator: '<',
        value: 3
      }
    ];

    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(100);

    const result = service.evaluateExitConditions(
      conditions,
      candles
    );

    expect(result).toBe(false);
  });

  it('should return false when there are no exit conditions', () => {
    const result = service.evaluateExitConditions([], candles);

    expect(result).toBe(false);
  });

  it('should return SELL when all strategy exit conditions are satisfied', () => {
    vi.spyOn(service.indicatorService, 'calculateLatestEma')
      .mockReturnValue(105);

    const strategy: Strategy = {
      id: '1',
      name: 'Test Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active',
      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 100
        },
        {
          indicator: 'EMA',
          operator: '>',
          value: 3
        }
      ]
    };

    const testCandles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 110,
        low: 99,
        close: 107
      }
    ];

    const result = service.evaluateStrategy(
      strategy,
      testCandles,
      'LONG'
    );

    expect(result).toBe('SELL');
  });

  it('should return true when fast EMA is above slow EMA', () => {
    const candles: MarketCandle[] = [
      { timestamp: 1, open: 100, high: 105, low: 95, close: 100, volume: 1000 },
      { timestamp: 2, open: 100, high: 110, low: 98, close: 108, volume: 1100 },
      { timestamp: 3, open: 108, high: 115, low: 105, close: 112, volume: 1200 },
      { timestamp: 4, open: 112, high: 120, low: 110, close: 118, volume: 1300 },
      { timestamp: 5, open: 118, high: 125, low: 115, close: 123, volume: 1400 }
    ];

    const result = service.evaluateEmaTrend(
      candles,
      2,
      4
    );

    expect(result).toBe(true);
  });

  it('should return false when there are not enough candles', () => {
    const candles: MarketCandle[] = [
      { timestamp: 1, open: 100, high: 105, low: 95, close: 100, volume: 1000 },
      { timestamp: 2, open: 100, high: 105, low: 95, close: 101, volume: 1000 }
    ];

    const result = service.evaluateEmaTrend(
      candles,
      2,
      4
    );

    expect(result).toBe(false);
  });

  it('should return true when EMA trend and price conditions are satisfied', () => {
    vi.spyOn(service, 'evaluateEmaTrend')
      .mockReturnValue(true);

    vi.spyOn(service, 'evaluatePriceVsEma')
      .mockReturnValue('BUY');

    const result = service.evaluateTrendEntry(candles);

    expect(result).toBe(true);
  });

  it('should return false when EMA trend condition fails', () => {
    vi.spyOn(service, 'evaluateEmaTrend')
      .mockReturnValue(false);

    const result = service.evaluateTrendEntry(candles);

    expect(result).toBe(false);
  });

  it('should return true when candle is bullish', () => {
    const candle: MarketCandle = {
      timestamp: 1,
      open: 100,
      high: 110,
      low: 99,
      close: 105,
      volume: 1000
    };

    const result = service.isBullishCandle(candle);

    expect(result).toBe(true);
  });

  it('should return false when candle is bearish', () => {
    const candle: MarketCandle = {
      timestamp: 1,
      open: 105,
      high: 110,
      low: 99,
      close: 100,
      volume: 1000
    };

    const result = service.isBullishCandle(candle);

    expect(result).toBe(false);
  });

  it('should return true when current volume is at least 1.2 times average volume', () => {
    const candles: MarketCandle[] = Array.from(
      { length: 21 },
      (_, index) => ({
        timestamp: index + 1,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: index === 20 ? 1200 : 1000
      })
    );

    const result =
      service.isVolumeConfirmed(candles);

    expect(result).toBe(true);
  });

  it('should return false when current volume is below 1.2 times average volume', () => {
    const candles: MarketCandle[] = Array.from(
      { length: 21 },
      (_, index) => ({
        timestamp: index + 1,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: index === 20 ? 1100 : 1000
      })
    );

    const result =
      service.isVolumeConfirmed(candles);

    expect(result).toBe(false);
  });

  it('should return false when there are not enough candles for volume confirmation', () => {
    const candles: MarketCandle[] = Array.from(
      { length: 20 },
      (_, index) => ({
        timestamp: index + 1,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000
      })
    );

    const result =
      service.isVolumeConfirmed(candles);

    expect(result).toBe(false);
  });

  it('should calculate ATR based stop loss', () => {
    const result = service.calculateAtrStopLoss(
      1000,
      10
    );

    expect(result).toBe(985);
  });

  it('should return 0 for invalid ATR stop loss inputs', () => {
    const result = service.calculateAtrStopLoss(
      1000,
      0
    );

    expect(result).toBe(0);
  });

  it('should calculate take profit at 2R', () => {
    const result = service.calculateTakeProfit(
      1000,
      985
    );

    expect(result).toBe(1030);
  });

  it('should return 0 when stop loss is above entry price', () => {
    const result = service.calculateTakeProfit(
      1000,
      1010
    );

    expect(result).toBe(0);
  });

  it('should return true when all intraday entry conditions are satisfied', () => {
    vi.spyOn(service, 'evaluateEmaTrend')
      .mockReturnValue(true);

    vi.spyOn(service, 'evaluatePriceVsEma')
      .mockReturnValue('BUY');

    vi.spyOn(service, 'isBullishCandle')
      .mockReturnValue(true);

    vi.spyOn(service, 'isVolumeConfirmed')
      .mockReturnValue(true);

    const result =
      service.evaluateIntradayEntry(intradayStrategy, candles);

    expect(result).toBe(true);
  });

  it('should return false when intraday trend condition fails', () => {
    vi.spyOn(service, 'evaluateEmaTrend')
      .mockReturnValue(false);

    const result =
      service.evaluateIntradayEntry(intradayStrategy, candles);

    expect(result).toBe(false);
  });

  it('should return BUY when intraday strategy entry conditions are satisfied', () => {
    vi.spyOn(service, 'evaluateIntradayEntry')
      .mockReturnValue(true);

    const strategy: Strategy = {
      id: 'intraday-test',
      name: 'NIFTY Intraday Trend',
      instrument: 'NIFTY50',
      timeframe: '15m',
      status: 'Active',
      type: 'INTRADAY'
    };

    const result = service.evaluateStrategy(
      strategy,
      candles,
      'NONE'
    );

    expect(result).toBe('BUY');
  });

  it('should return WAIT when intraday strategy entry conditions are not satisfied', () => {
    vi.spyOn(service, 'evaluateIntradayEntry')
      .mockReturnValue(false);

    const strategy: Strategy = {
      id: 'intraday-test',
      name: 'NIFTY Intraday Trend',
      instrument: 'NIFTY50',
      timeframe: '15m',
      status: 'Active',
      type: 'INTRADAY'
    };

    const result = service.evaluateStrategy(
      strategy,
      candles,
      'NONE'
    );

    expect(result).toBe('WAIT');
  });

  it('should return intraday trade setup when entry conditions are satisfied', () => {
    vi.spyOn(service, 'evaluateIntradayEntry')
      .mockReturnValue(true);

    vi.spyOn(indicatorService, 'calculateAtr')
      .mockReturnValue(10);

    const result =
      service.evaluateIntradaySetup(intradayStrategy, candles);

    expect(result).toEqual({
      entryPrice: 101,
      stopLossPrice: 86,
      takeProfitPrice: 131
    });
  });
});