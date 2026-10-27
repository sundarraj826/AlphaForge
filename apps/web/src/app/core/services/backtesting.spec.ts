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
    expect(result.totalProfitLoss).toBeCloseTo(11.831115104, 8);

    expect(result.trades).toHaveLength(1);

    expect(result.trades[0]).toEqual({
      entryPrice: 101,
      exitPrice: 107,
      quantity: 2,
      profitLoss: 11.831115104
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
    expect(result.totalProfitLoss).toBeCloseTo(-7.07935417, 8);

    expect(result.maxDrawdown).toBeCloseTo(7.07935417, 8);
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
    expect(result.totalProfitLoss).toBeCloseTo(6.82738245, 8);

    expect(result.equityCurve).toEqual([
      100000,
      100005.915557552,
      100006.82738245
    ]);

    expect(result.trades).toHaveLength(2);

    expect(result.trades[0]).toEqual({
      entryPrice: 101,
      exitPrice: 107,
      quantity: 1,
      profitLoss: 5.915557552
    });

    expect(result.trades[1]).toEqual({
      entryPrice: 108,
      exitPrice: 109,
      quantity: 1,
      profitLoss: 0.911824898
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
    expect(result.totalProfitLoss).toBeCloseTo(-2.080498388, 8);

    expect(result.trades[0]).toEqual({
      entryPrice: 100,
      exitPrice: 98,
      quantity: 1,
      profitLoss: -2.080498388
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
    expect(result.totalProfitLoss).toBeCloseTo(4.91676177, 8);

    expect(result.trades[0]).toEqual({
      entryPrice: 100,
      exitPrice: 105,
      quantity: 1,
      profitLoss: 4.91676177
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
      "profitLoss": -0.08534525999999999
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
        open: 100,
        high: 112,
        low: 99,
        close: 110
      },
      {
        timestamp: 3,
        open: 110,
        high: 111,
        low: 109,
        close: 110
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000
    );

    expect(result.totalTrades).toBe(1);
    expect(result.totalFees).toBeCloseTo(0.08519526, 8);
    expect(result.totalProfitLoss).toBeCloseTo(9.91480474, 8);

    expect(result.trades[0]).toEqual({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      profitLoss: 9.91480474
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
        open: 100,
        high: 112,
        low: 99,
        close: 110
      },
      {
        timestamp: 3,
        open: 110,
        high: 111,
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
    expect(result.totalFees).toBe(0.08519434594);
    expect(result.totalProfitLoss).toBeCloseTo(9.704805654060007, 8);

    expect(result.trades[0].entryPrice).toBeCloseTo(100.1);
    expect(result.trades[0].exitPrice).toBeCloseTo(109.89);
    expect(result.trades[0].quantity).toBe(1);
    expect(result.trades[0].profitLoss).toBeCloseTo(9.704805654060007, 8);
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
        open: 100,
        high: 112,
        low: 99,
        close: 110
      },
      {
        timestamp: 3,
        open: 110,
        high: 111,
        low: 109,
        close: 110
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000
    );

    expect(result.totalTrades).toBe(1);
    expect(result.grossProfit).toBeCloseTo(10);
    expect(result.totalFees).toBeCloseTo(0.08519526, 8);
    expect(result.totalProfitLoss).toBeCloseTo(9.91480474, 8);
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
        open: 99,
        high: 101,
        low: 98,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 112,
        low: 99,
        close: 110
      },
      {
        timestamp: 3,
        open: 110,
        high: 111,
        low: 99,
        close: 100
      },
      {
        timestamp: 4,
        open: 100,
        high: 101,
        low: 84,
        close: 85
      },
      {
        timestamp: 5,
        open: 85,
        high: 86,
        low: 84,
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
      3,
      4
    );

    expect(result.totalTrades).toBe(1);
    expect(result.totalProfitLoss).toBe(3.916340364);
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
        low: 101,
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
      100002.91673177,
      99995.83331354,
    ]);

    expect(result.maxDrawdown).toBe(7.08341823000228);
    expect(result.maxDrawdownPercent).toBeCloseTo(0.007);
  });

  it('should calculate position quantity based on risk', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Risk Based Position Sizing Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',

      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 499
        }
      ],

      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 505
        }
      ],

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
        open: 495,
        high: 505,
        low: 490,
        close: 500
      },
      {
        timestamp: 2,
        open: 500,
        high: 510,
        low: 498,
        close: 510
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      undefined,
      undefined,
      1
    );

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].quantity).toBe(100);
  });

  it('should not create a trade when risk based quantity is zero', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Zero Quantity Risk Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',

      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 499
        }
      ],

      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 505
        }
      ],

      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 0,
        takeProfitPercent: 5,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 495,
        high: 505,
        low: 490,
        close: 500
      },
      {
        timestamp: 2,
        open: 500,
        high: 510,
        low: 498,
        close: 510
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      undefined,
      undefined,
      1
    );

    expect(result.totalTrades).toBe(0);
    expect(result.trades).toHaveLength(0);
  });

  it('should reduce position quantity when stop loss is farther away', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Far Stop Loss Risk Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',

      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 499
        }
      ],

      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 505
        }
      ],

      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 10,
        takeProfitPercent: 5,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 495,
        high: 505,
        low: 490,
        close: 500
      },
      {
        timestamp: 2,
        open: 500,
        high: 510,
        low: 498,
        close: 510
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      undefined,
      undefined,
      1
    );

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);

    expect(result.trades[0].quantity).toBe(20);
  });

  it('should calculate position size from current capital after a loss', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Capital Based Risk Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',

      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 499
        }
      ],

      exitConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 505
        }
      ],

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
        open: 495,
        high: 505,
        low: 490,
        close: 500
      },
      {
        timestamp: 2,
        open: 500,
        high: 500,
        low: 490,
        close: 490
      },
      {
        timestamp: 3,
        open: 490,
        high: 500,
        low: 485,
        close: 500
      },
      {
        timestamp: 4,
        open: 500,
        high: 510,
        low: 498,
        close: 510
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      undefined,
      undefined,
      1
    );

    expect(result.totalTrades).toBe(2);
    expect(result.trades).toHaveLength(2);

    expect(result.trades[0].quantity).toBe(100);
    expect(result.trades[1].quantity).toBeLessThan(100);
  });

  it('should limit position quantity when risk sizing exceeds available capital', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Capital Limit Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 499 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 505 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 0.2,
        takeProfitPercent: 5,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 499,
        high: 500,
        low: 498,
        close: 500
      },
      {
        timestamp: 2,
        open: 500,
        high: 510,
        low: 499,
        close: 510
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      undefined,
      undefined,
      1
    );

    expect(result.totalTrades).toBe(1);
    expect(result.trades[0].quantity).toBe(200);
  });

  it('should stop opening new trades after reaching maximum daily loss', () => {
    const strategy: Strategy = {
      id: '1',
      name: 'Daily Loss Limit Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 499 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 505 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 5,
        maxDailyLossPercent: 1,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 495,
        high: 500,
        low: 490,
        close: 500
      },
      {
        timestamp: 2,
        open: 500,
        high: 500,
        low: 480,
        close: 480
      },
      {
        timestamp: 3,
        open: 480,
        high: 500,
        low: 475,
        close: 500
      },
      {
        timestamp: 4,
        open: 500,
        high: 510,
        low: 498,
        close: 510
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      undefined,
      undefined,
      1
    );

    expect(result.totalTrades).toBe(1);
  });


  it('should reset the daily loss limit on a new trading day', () => {
    const strategy: Strategy = {
      id: 'daily-reset',
      name: 'Daily Loss Reset Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 499 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 505 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 5,
        maxDailyLossPercent: 1,
        maxOpenTrades: 1
      }
    };

    const day1 = new Date('2026-10-08T10:00:00+05:30').getTime();
    const day2 = new Date('2026-10-09T10:00:00+05:30').getTime();

    const candles: MarketCandle[] = [
      {
        timestamp: day1,
        open: 499,
        high: 500,
        low: 490,
        close: 500
      },
      {
        timestamp: day1 + 15 * 60 * 1000,
        open: 500,
        high: 500,
        low: 480,
        close: 480
      },
      {
        timestamp: day1 + 30 * 60 * 1000,
        open: 480,
        high: 500,
        low: 475,
        close: 500
      },
      {
        timestamp: day2,
        open: 500,
        high: 500,
        low: 498,
        close: 500
      },
      {
        timestamp: day2 + 15 * 60 * 1000,
        open: 500,
        high: 510,
        low: 499,
        close: 510
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000,
      0,
      undefined,
      undefined,
      1
    );

    expect(result.totalTrades).toBe(2);
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0].profitLoss).toBeLessThan(0);
    expect(result.trades[1].profitLoss).toBeGreaterThan(0);
  });


  it('should force close an open position at end of day', () => {
    const strategy: Strategy = {
      id: 'eod-test',
      name: 'EOD Exit Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 110 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 0,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const entryTimestamp = new Date(
      '2026-10-12T15:00:00+05:30'
    ).getTime();

    const eodTimestamp = new Date(
      '2026-10-12T15:15:00+05:30'
    ).getTime();

    const candles: MarketCandle[] = [
      {
        timestamp: entryTimestamp,
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: eodTimestamp,
        open: 100,
        high: 104,
        low: 100,
        close: 103
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      1,
      100000
    );

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryPrice).toBe(100);
    expect(result.trades[0].exitPrice).toBe(103);
    expect(result.totalFees).toBeGreaterThan(0);
    expect(result.totalProfitLoss).toBeGreaterThan(0);


    expect(result.totalProfitLoss).toBeCloseTo(
      result.grossProfit - result.grossLoss - result.totalFees,
      8
    );

    expect(result.finalCapital).toBeCloseTo(
      result.initialCapital + result.totalProfitLoss,
      8
    );

    expect(result.equityCurve[result.equityCurve.length - 1])
      .toBeCloseTo(result.finalCapital, 8);

  });


  it('should not count an open position as completed when data ends before EOD', () => {
    const strategy: Strategy = {
      id: 'incomplete-session',
      name: 'Incomplete Session Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 110 }
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
        timestamp: new Date(
          '2026-10-12T14:30:00+05:30'
        ).getTime(),
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: new Date(
          '2026-10-12T14:45:00+05:30'
        ).getTime(),
        open: 100,
        high: 103,
        low: 99,
        close: 102
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(0);
    expect(result.trades).toHaveLength(0);
  });


  it('should record only one trade when SELL signal occurs at EOD', () => {
    const strategy: Strategy = {
      id: 'eod-sell-test',
      name: 'EOD SELL Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 102 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 0,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const entryTimestamp = new Date(
      '2026-10-12T15:00:00+05:30'
    ).getTime();

    const eodTimestamp = new Date(
      '2026-10-12T15:15:00+05:30'
    ).getTime();

    const candles: MarketCandle[] = [
      {
        timestamp: entryTimestamp,
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: eodTimestamp,
        open: 100,
        high: 104,
        low: 100,
        close: 103
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitPrice).toBe(103);
    expect(result.totalFees).toBeGreaterThan(0);
  });


  it('should record only one trade when stop loss triggers at EOD', () => {
    const strategy: Strategy = {
      id: 'eod-stop-loss',
      name: 'EOD Stop Loss Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: new Date(
          '2026-10-12T15:00:00+05:30'
        ).getTime(),
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: new Date(
          '2026-10-12T15:15:00+05:30'
        ).getTime(),
        open: 100,
        high: 101,
        low: 97,
        close: 99
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryPrice).toBe(100);
    expect(result.trades[0].exitPrice).toBe(98);
    expect(result.trades[0].profitLoss).toBeLessThan(0);
  });


  it('should record only one trade when take profit triggers at EOD', () => {
    const strategy: Strategy = {
      id: 'eod-take-profit',
      name: 'EOD Take Profit Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 0,
        takeProfitPercent: 3,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: new Date(
          '2026-10-12T15:00:00+05:30'
        ).getTime(),
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: new Date(
          '2026-10-12T15:15:00+05:30'
        ).getTime(),
        open: 100,
        high: 104,
        low: 100,
        close: 103
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryPrice).toBe(100);
    expect(result.trades[0].exitPrice).toBe(103);
    expect(result.trades[0].profitLoss).toBeGreaterThan(0);
  });


  it('should prioritize stop loss when both SL and TP are hit in the same candle', () => {
    const strategy: Strategy = {
      id: 'same-candle-sl-tp',
      name: 'Same Candle SL TP Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 3,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: new Date(
          '2026-10-12T14:45:00+05:30'
        ).getTime(),
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: new Date(
          '2026-10-12T15:00:00+05:30'
        ).getTime(),
        open: 100,
        high: 104,
        low: 97,
        close: 101
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryPrice).toBe(100);
    expect(result.trades[0].exitPrice).toBe(98);
    expect(result.trades[0].profitLoss).toBeLessThan(0);
  });


  it('should maintain consistent P&L accounting across completed trades', () => {
    const strategy: Strategy = {
      id: 'accounting-consistency',
      name: 'Accounting Consistency Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 102 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 3,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 104,
        low: 99,
        close: 103
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(1);

    expect(result.totalProfitLoss).toBeCloseTo(
      result.grossProfit - result.grossLoss - result.totalFees,
      8
    );

    expect(result.finalCapital).toBeCloseTo(
      result.initialCapital + result.totalProfitLoss,
      8
    );

    expect(result.equityCurve[result.equityCurve.length - 1])
      .toBeCloseTo(result.finalCapital, 8);
  });


  it('should allow an open position to exit when the daily loss limit is reached', () => {
    const strategy: Strategy = {
      id: 'daily-loss-open-position',
      name: 'Daily Loss Open Position Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 110 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 0,
        maxDailyLossPercent: 1,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 99,
        high: 101,
        low: 99,
        close: 100
      },
      {
        timestamp: 2,
        open: 100,
        high: 101,
        low: 97,
        close: 98
      }
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitPrice).toBe(98);
    expect(result.trades[0].profitLoss).toBeLessThan(0);
  });


  it('should reset the daily-loss limit on the next trading day', () => {
    const strategy: Strategy = {
      id: 'daily-loss-reset',
      name: 'Daily Loss Reset Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 }
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 110 }
      ],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 0,
        maxDailyLossPercent: 1,
        maxOpenTrades: 1
      }
    };

    const candles: MarketCandle[] = [
      // Day 1: enter a position
      {
        timestamp: new Date('2026-10-12T10:00:00+05:30').getTime(),
        open: 100,
        high: 101,
        low: 99,
        close: 100
      },
      // Day 1: stop-loss hit; loss exceeds the daily limit
      {
        timestamp: new Date('2026-10-12T10:15:00+05:30').getTime(),
        open: 100,
        high: 100,
        low: 97,
        close: 98
      },
      // Day 1: another entry should be blocked
      {
        timestamp: new Date('2026-10-12T10:30:00+05:30').getTime(),
        open: 100,
        high: 101,
        low: 99,
        close: 100
      },
      // Day 2: daily-loss tracking should reset
      {
        timestamp: new Date('2026-10-13T10:00:00+05:30').getTime(),
        open: 100,
        high: 101,
        low: 99,
        close: 100
      },
      // Day 2: close the new position at its stop-loss
      {
        timestamp: new Date('2026-10-13T10:15:00+05:30').getTime(),
        open: 100,
        high: 100,
        low: 97,
        close: 98
      }
    ];

    const result = service.runBacktest(
      strategy,
      candles,
      100,
      10000
    );

    expect(result.totalTrades).toBe(2);
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0].profitLoss).toBeLessThan(0);
    expect(result.trades[1].profitLoss).toBeLessThan(0);
  });


  it('should not enter at the same candle close that generated a BUY signal', () => {
    const strategy: Strategy = {
      id: 'next-candle-entry',
      name: 'Next Candle Entry Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 99 },
      ],
      exitConditions: [],
      riskManagement: {
        riskPerTrade: 1,
        stopLossPercent: 2,
        takeProfitPercent: 0,
        maxDailyLossPercent: 5,
        maxOpenTrades: 1,
      },
    };

    const candles: MarketCandle[] = [
      {
        timestamp: new Date('2026-10-12T10:00:00+05:30').getTime(),
        open: 99,
        high: 101,
        low: 99,
        close: 100,
      },
      {
        timestamp: new Date('2026-10-12T10:15:00+05:30').getTime(),
        open: 105,
        high: 106,
        low: 104,
        close: 105,
      },
      {
        timestamp: new Date('2026-10-12T10:30:00+05:30').getTime(),
        open: 106,
        high: 107,
        low: 105,
        close: 106,
      },
    ];

    const result = service.runBacktest(strategy, candles);

    expect(
      result.trades.some(trade => trade.entryPrice === 100)
    ).toBe(false);
  });


  it('should enter at the next candle open after a BUY signal', () => {
    const strategy: Strategy = {
      id: 'next-candle-entry',
      name: 'Next Candle Entry Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 100 },
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 115 },
      ],
    };

    const candles: MarketCandle[] = [
      {
        timestamp: new Date('2026-10-12T10:00:00+05:30').getTime(),
        open: 99,
        high: 102,
        low: 98,
        close: 101,
      },
      {
        timestamp: new Date('2026-10-12T10:15:00+05:30').getTime(),
        open: 110,
        high: 112,
        low: 109,
        close: 110,
      },
      {
        timestamp: new Date('2026-10-12T10:30:00+05:30').getTime(),
        open: 116,
        high: 121,
        low: 115,
        close: 120,
      },
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(1);
    expect(result.trades[0].entryPrice).toBe(110);
  });


  it('should not carry a pending BUY signal into the next trading day', () => {
    const strategy: Strategy = {
      id: 'pending-buy-next-day',
      name: 'Pending BUY Next Day Strategy',
      instrument: 'RELIANCE',
      timeframe: '15m',
      status: 'Active',
      entryConditions: [
        { indicator: 'Price', operator: '>', value: 100 },
      ],
      exitConditions: [
        { indicator: 'Price', operator: '>', value: 115 },
      ],
    };

    const candles: MarketCandle[] = [
      // Day 1: generates a BUY signal.
      {
        timestamp: new Date('2026-10-12T10:00:00+05:30').getTime(),
        open: 99,
        high: 102,
        low: 98,
        close: 101,
      },
      // Day 2: must not execute the previous day's pending BUY.
      {
        timestamp: new Date('2026-10-13T10:00:00+05:30').getTime(),
        open: 110,
        high: 112,
        low: 100,
        close: 100,
      },
      // A fresh BUY signal may be generated, but entry is next candle.
      {
        timestamp: new Date('2026-10-13T10:15:00+05:30').getTime(),
        open: 116,
        high: 121,
        low: 115,
        close: 120,
      },
    ];

    const result = service.runBacktest(strategy, candles);

    expect(result.totalTrades).toBe(0);
    expect(result.trades).toHaveLength(0);
  });


});