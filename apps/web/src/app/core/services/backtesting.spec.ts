import { TestBed } from '@angular/core/testing';

import { BacktestingService } from './backtesting';
import { StrategyService } from './strategy';
import { MarketCandle } from '../models/market-candle.model';
import { Strategy } from '../models/strategy.model';

describe('BacktestingService', () => {

  let service: BacktestingService;

  beforeEach(() => {

    TestBed.configureTestingModule({
      providers: [
        BacktestingService,
        StrategyService
      ]
    });

    service = TestBed.inject(BacktestingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return zero trades when no candles are provided', () => {

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
        }
      ]
    };

    const candles: MarketCandle[] = [];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(0);
    expect(result.winningTrades).toBe(0);
    expect(result.losingTrades).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.totalProfitLoss).toBe(0);
  });

  it('should execute a trade and calculate profit', () => {

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
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 105
        },
      ]
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 101
      },
      {
        timestamp: 2,
        open: 101,
        high: 108,
        low: 100,
        close: 107
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      2
    );

    expect(result.totalTrades).toBe(1);
    expect(result.winningTrades).toBe(1);
    expect(result.losingTrades).toBe(0);
    expect(result.winRate).toBe(100);
    expect(result.totalProfitLoss).toBe(12);

    expect(result.trades).toHaveLength(1);

    expect(result.trades[0]).toEqual({
      entryPrice: 101,
      exitPrice: 107,
      quantity: 2,
      profitLoss: 12
    });
  });

  it('should execute a losing trade and calculate loss', () => {

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
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '<',
          value: 95
        }
      ]
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 101
      },
      {
        timestamp: 2,
        open: 101,
        high: 102,
        low: 90,
        close: 94
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(1);
    expect(result.winningTrades).toBe(0);
    expect(result.losingTrades).toBe(1);
    expect(result.winRate).toBe(0);
    expect(result.totalProfitLoss).toBe(-7);

    expect(result.maxDrawdown).toBe(7);
    expect(result.maxDrawdownPercent).toBeCloseTo(0.007);
  });

  it('should execute multiple trades and calculate the overall result', () => {

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
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 105
        }
      ]
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 101
      },
      {
        timestamp: 2,
        open: 101,
        high: 108,
        low: 100,
        close: 107
      },
      {
        timestamp: 3,
        open: 107,
        high: 109,
        low: 106,
        close: 108
      },
      {
        timestamp: 4,
        open: 108,
        high: 110,
        low: 107,
        close: 109
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(2);
    expect(result.winningTrades).toBe(2);
    expect(result.losingTrades).toBe(0);
    expect(result.winRate).toBe(100);
    expect(result.totalProfitLoss).toBe(7);

    expect(result.equityCurve).toEqual([
      100000,
      100006,
      100007
    ])

    expect(result.trades).toHaveLength(2);

    expect(result.trades[0]).toEqual({
      entryPrice: 101,
      exitPrice: 107,
      quantity: 1,
      profitLoss: 6
    });

    expect(result.trades[1]).toEqual({
      entryPrice: 108,
      exitPrice: 109,
      quantity: 1,
      profitLoss: 1
    });
  });

  it('should not count an open position as a completed trade', () => {

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
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 105
        }
      ]
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 101
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(0);
    expect(result.winningTrades).toBe(0);
    expect(result.losingTrades).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.totalProfitLoss).toBe(0);
  });

  it('should close a long position at stop loss', () => {

    const strategy: Strategy = {
      id: '1',
      name: 'Stop Loss Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 99
        }
      ],
      exitConditions: [],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 5,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 101,
        low: 97,
        close: 99
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(1);
    expect(result.winningTrades).toBe(0);
    expect(result.losingTrades).toBe(1);
    expect(result.totalProfitLoss).toBe(-2);

    expect(result.trades[0]).toEqual({
      entryPrice: 100,
      exitPrice: 98,
      quantity: 1,
      profitLoss: -2
    });
  });

  it('should close a long position at take profit', () => {

    const strategy: Strategy = {
      id: '1',
      name: 'Take Profit Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 99
        }
      ],
      exitConditions: [],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 5,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 106,
        low: 99,
        close: 104
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(1);
    expect(result.winningTrades).toBe(1);
    expect(result.losingTrades).toBe(0);
    expect(result.winRate).toBe(100);
    expect(result.totalProfitLoss).toBe(5);

    expect(result.trades[0]).toEqual({
      entryPrice: 100,
      exitPrice: 105,
      quantity: 1,
      profitLoss: 5
    });
  });

  it('should evaluate EMA strategy using historical candles', () => {

    const strategy: Strategy = {
      id: '1',
      name: 'EMA Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'EMA',
          operator: '>',
          value: 3
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '<',
          value: 106
        }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 0,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 103,
        low: 99,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 104,
        low: 99,
        close: 102
      },
      {
        timestamp: 3,
        open: 102,
        high: 103,
        low: 100,
        close: 101
      },
      {
        timestamp: 4,
        open: 101,
        high: 106,
        low: 100,
        close: 105
      },
      {
        timestamp: 5,
        open: 105,
        high: 108,
        low: 104,
        close: 107
      },
      {
        timestamp: 6,
        open: 107,
        high: 108,
        low: 104,
        close: 105
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(1);
    expect(result.trades.length).toBe(1);

    expect(result.trades[0]).toEqual({
      entryPrice: 105,
      exitPrice: 105,
      quantity: 1,
      profitLoss: 0
    });
  });

  it('should calculate trading fees and net profit', () => {

    const strategy: Strategy = {
      id: '1',
      name: 'Fee Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
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
        stopLossPercent: 0,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 100
      },
      {
        timestamp: 2,
        open: 110,
        high: 112,
        low: 109,
        close: 110
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0.1
    );

    expect(result.totalTrades).toBe(1);
    expect(result.totalFees).toBeCloseTo(0.21);
    expect(result.totalProfitLoss).toBeCloseTo(9.79);

    expect(result.trades[0]).toEqual({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      profitLoss: 9.79
    });
  });

  it('should calculate slippage and net profit', () => {

    const strategy: Strategy = {
      id: '1',
      name: 'Slippage Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
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
        stopLossPercent: 0,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 100
      },
      {
        timestamp: 2,
        open: 110,
        high: 112,
        low: 109,
        close: 110
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      0.1
    );

    expect(result.totalTrades).toBe(1);
    expect(result.totalFees).toBe(0);
    expect(result.totalProfitLoss).toBeCloseTo(9.79);

    expect(result.trades[0].entryPrice).toBeCloseTo(100.1);
    expect(result.trades[0].exitPrice).toBeCloseTo(109.89);
    expect(result.trades[0].quantity).toBe(1);
    expect(result.trades[0].profitLoss).toBeCloseTo(9.79);
  });

  it('should calculate gross profit separately from net profit', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Gross Profit Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
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
        stopLossPercent: 0,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 100
      },
      {
        timestamp: 2,
        open: 110,
        high: 112,
        low: 109,
        close: 110
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0.1,
      0
    );

    expect(result.totalTrades).toBe(1);
    expect(result.grossProfit).toBeCloseTo(10);
    expect(result.totalFees).toBeCloseTo(0.21);
    expect(result.totalProfitLoss).toBeCloseTo(9.79);
  });

  it('should calculate profit factor', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Profit Factor Test',
      instrument: 'XAU/USD',
      timeframe: '15m',
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
      ]
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 0,
        high: 0,
        low: 0,
        close: 100
      },
      {
        timestamp: 2,
        open: 0,
        high: 0,
        low: 0,
        close: 110
      },
      {
        timestamp: 3,
        open: 0,
        high: 0,
        low: 0,
        close: 100
      },
      {
        timestamp: 4,
        open: 0,
        high: 0,
        low: 0,
        close: 85
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.grossProfit).toBe(10);
    expect(result.grossLoss).toBe(15);
    expect(result.profitFactor).toBeCloseTo(10 / 15);
  });

  it('should filter candles by start and end timestamp', () => {
    const strategyService = TestBed.inject(StrategyService);
    const strategy = strategyService.strategies()[0];

    const candles = [
      {
        timestamp: 1,
        open: 100,
        high: 103,
        low: 99,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 104,
        low: 99,
        close: 102
      },
      {
        timestamp: 3,
        open: 102,
        high: 103,
        low: 100,
        close: 101
      },
      {
        timestamp: 4,
        open: 101,
        high: 106,
        low: 100,
        close: 105
      },
      {
        timestamp: 5,
        open: 105,
        high: 108,
        low: 104,
        close: 107
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      0,
      3,
      4
    );

    expect(result.totalTrades).toBe(1);
    expect(result.totalProfitLoss).toBe(4);
  });

  it('should calculate maximum drawdown', () => {
    const strategyService = TestBed.inject(StrategyService);
    const strategy = strategyService.strategies()[0];

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 100,
        low: 100,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 106,
        low: 100,
        close: 106
      },
      {
        timestamp: 3,
        open: 106,
        high: 106,
        low: 101,
        close: 101
      },
      {
        timestamp: 4,
        open: 101,
        high: 110,
        low: 101,
        close: 110
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000
    );

    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(result.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
  });

  it('should calculate maximum drawdown from an equity decline', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Drawdown Strategy',
      instrument: 'XAU/USD',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 100
        }
      ],
      exitConditions: [
        {
          indicator: 'Price',
          operator: '<',
          value: 105
        }
      ]
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 98,
        close: 101
      },
      {
        timestamp: 2,
        open: 101,
        high: 105,
        low: 103,
        close: 104
      },
      {
        timestamp: 3,
        open: 104,
        high: 107,
        low: 103,
        close: 106
      },
      {
        timestamp: 4,
        open: 106,
        high: 107,
        low: 98,
        close: 99
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles
    );

    expect(result.totalTrades).toBe(2);
    expect(result.winningTrades).toBe(1);
    expect(result.losingTrades).toBe(1);

    expect(result.equityCurve).toEqual([
      100000,
      100003,
      99996
    ]);

    expect(result.maxDrawdown).toBe(7);
    expect(result.maxDrawdownPercent).toBeCloseTo(0.007);
  });
});