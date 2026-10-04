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
});