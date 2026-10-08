import { TestBed } from '@angular/core/testing';

import { PaperTradingRunnerService } from './paper-trading-runner';
import { PaperTradingService } from './paper-trading';
import { StrategyService } from './strategy';
import { IndicatorService } from './indicators';
import { Strategy } from '../models/strategy.model';
import { MarketCandle } from '../models/market-candle.model';
import { PositionSizingService } from './position-sizing';

describe('PaperTradingRunnerService', () => {

  let service: PaperTradingRunnerService;
  let paperTradingService: PaperTradingService;
  let strategyService: StrategyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PaperTradingRunnerService,
        PaperTradingService,
        StrategyService,
        IndicatorService,
        PositionSizingService
      ]
    });

    service = TestBed.inject(PaperTradingRunnerService);
    paperTradingService = TestBed.inject(PaperTradingService);
    strategyService = TestBed.inject(StrategyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a paper BUY order when strategy returns BUY', () => {

    const strategy: Strategy = {
      id: 'test-strategy',
      name: 'Test Strategy',
      instrument: 'TEST',
      timeframe: '1m',
      status: 'Active' as const,
      entryConditions: [
        {
          indicator: 'Price',
          operator: '>',
          value: 99
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
        timestamp: Date.now(),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      }
    ];

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('BUY');

    const orders = paperTradingService.orders;

    expect(orders).toHaveLength(1);
    expect(orders[0].symbol).toBe(strategy.instrument);
    expect(orders[0].side).toBe('BUY');
    expect(orders[0].quantity).toBe(476);
    expect(orders[0].requestedPrice).toBe(105);
    expect(orders[0].status).toBe('FILLED');
  });

  it('should open a virtual position after a paper BUY order is filled', () => {

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
        timestamp: Date.now(),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      }
    ];

    service.run(
      strategy,
      candles,
      'NONE'
    );

    const positions = paperTradingService.positions;

    expect(positions).toHaveLength(1);
    expect(positions[0].symbol).toBe(strategy.instrument);
    expect(positions[0].side).toBe('LONG');
    expect(positions[0].quantity).toBe(476);
    expect(positions[0].entryPrice).toBe(105);
    expect(positions[0].currentPrice).toBe(105);
    expect(positions[0].unrealizedProfitLoss).toBe(0);
  });

  it('should update unrealized P&L when the market price changes', () => {

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
        timestamp: Date.now(),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      }
    ];

    service.run(
      strategy,
      candles,
      'NONE'
    );

    paperTradingService.updatePositionPrice(
      strategy.instrument,
      110
    );

    const positions = paperTradingService.positions;

    expect(positions).toHaveLength(1);
    expect(positions[0].currentPrice).toBe(110);
    expect(positions[0].unrealizedProfitLoss).toBe(2380);
  });

  it('should close the virtual position and calculate realized P&L', () => {

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
        timestamp: Date.now(),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      }
    ];

    service.run(
      strategy,
      candles,
      'NONE'
    );

    const realizedProfitLoss =
      paperTradingService.closePosition(
        strategy.instrument,
        110
      );

    expect(realizedProfitLoss).toBe(2380);
    expect(paperTradingService.positions).toHaveLength(0);
    expect(paperTradingService.capital).toBe(102380);
  });

  it('should close the virtual position when strategy returns SELL', () => {

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

    const buyCandles: MarketCandle[] = [
      {
        timestamp: Date.now(),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      }
    ];

    service.run(
      strategy,
      buyCandles,
      'NONE'
    );

    expect(paperTradingService.positions).toHaveLength(1);

    const sellCandles: MarketCandle[] = [
      {
        timestamp: Date.now() + 60000,
        open: 109,
        high: 112,
        low: 108,
        close: 110,
        volume: 1000
      }
    ];

    const signal = service.run(
      strategy,
      sellCandles,
      'LONG'
    );

    expect(signal).toBe('SELL');
    expect(paperTradingService.positions).toHaveLength(0);
    expect(paperTradingService.capital).toBe(102380);
  });

  it('should close the position when stop loss is reached', () => {
    const strategy: Strategy = {
      id: 'stop-loss-test',
      name: 'Stop Loss Test',
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
          value: 50
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

    const entryCandle: MarketCandle = {
      timestamp: 1,
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000
    };

    const stopLossCandle: MarketCandle = {
      timestamp: 2,
      open: 105,
      high: 106,
      low: 100,
      close: 102,
      volume: 1000
    };

    service.run(strategy, [entryCandle], 'NONE');

    const signal = service.run(
      strategy,
      [entryCandle, stopLossCandle],
      'LONG'
    );

    expect(signal).toBe('SELL');
    expect(paperTradingService.positions).toHaveLength(0);
    expect(paperTradingService.trades).toHaveLength(1);
    expect(paperTradingService.trades[0].profitLoss).toBe(-1428);
  });

  it('should close the position when take profit is reached', () => {
    const strategy: Strategy = {
      id: 'take-profit-test',
      name: 'Take Profit Test',
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
          value: 50
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

    const entryCandle: MarketCandle = {
      timestamp: 1,
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000
    };

    const takeProfitCandle: MarketCandle = {
      timestamp: 2,
      open: 105,
      high: 112,
      low: 105,
      close: 110,
      volume: 1000
    };

    service.run(
      strategy,
      [entryCandle],
      'NONE'
    );

    const signal = service.run(
      strategy,
      [entryCandle, takeProfitCandle],
      'LONG'
    );

    expect(signal).toBe('SELL');
    expect(paperTradingService.positions).toHaveLength(0);
    expect(paperTradingService.trades).toHaveLength(1);
    expect(paperTradingService.trades[0].profitLoss).toBe(2380);
  });

  it('should create an INTRADAY BUY order using ATR-based stop loss for position sizing', () => {
    const strategy: Strategy = {
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 150 - 0.5,
      high: 151,
      low: 149,
      close: 150,
      volume: 1500
    });

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('BUY');

    const orders = paperTradingService.orders;

    expect(orders).toHaveLength(1);
    expect(orders[0].symbol).toBe('NIFTY50');
    expect(orders[0].side).toBe('BUY');
    expect(orders[0].quantity).toBeGreaterThan(0);
    expect(orders[0].requestedPrice).toBe(150);
    expect(orders[0].status).toBe('FILLED');
  });

  it('should reduce INTRADAY quantity when ATR stop loss is wider', () => {
    const strategy: Strategy = {
      id: 'intraday-risk-test',
      name: 'NIFTY Intraday Risk Test',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 149.5,
      high: 151,
      low: 149,
      close: 150,
      volume: 1500
    });

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('BUY');

    const order = paperTradingService.orders[0];

    expect(order.quantity).toBeGreaterThan(0);

    const setup =
      TestBed.inject(StrategyService).evaluateIntradaySetup(
        strategy,
        candles
      );

    expect(setup).not.toBeNull();

    if (!setup) {
      return;
    }

    const riskPerShare =
      setup.entryPrice - setup.stopLossPrice;

    const expectedRiskAmount =
      paperTradingService.capital *
      (strategy.riskManagement!.riskPerTrade / 100);

    const expectedQuantity =
      Math.floor(
        expectedRiskAmount / riskPerShare
      );

    expect(order.quantity).toBe(
      Math.min(
        expectedQuantity,
        Math.floor(
          paperTradingService.capital /
          setup.entryPrice
        )
      )
    );
  });

  it('should not create an INTRADAY BUY order when there are insufficient candles', () => {
    const strategy: Strategy = {
      id: 'intraday-insufficient-data-test',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 10; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('WAIT');

    expect(paperTradingService.orders).toHaveLength(0);

    expect(paperTradingService.positions).toHaveLength(0);
  });

  it('should not create an INTRADAY BUY order when the latest candle is bearish', () => {
    const strategy: Strategy = {
      id: 'intraday-bearish-test',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 151,
      high: 152,
      low: 149,
      close: 150,
      volume: 1500
    });

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('WAIT');

    expect(paperTradingService.orders).toHaveLength(0);

    expect(paperTradingService.positions).toHaveLength(0);
  });

  it('should not create an INTRADAY BUY order when volume confirmation fails', () => {
    const strategy: Strategy = {
      id: 'intraday-volume-test',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 149.5,
      high: 151,
      low: 149,
      close: 150,
      volume: 1000
    });

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('WAIT');

    expect(paperTradingService.orders).toHaveLength(0);

    expect(paperTradingService.positions).toHaveLength(0);
  });

  it('should not create an INTRADAY BUY order when EMA trend is bearish', () => {
    const strategy: Strategy = {
      id: 'intraday-ema-test',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 150 - index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 100 - 0.5,
      high: 101,
      low: 99,
      close: 100,
      volume: 1500
    });

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('WAIT');

    expect(paperTradingService.orders).toHaveLength(0);

    expect(paperTradingService.positions).toHaveLength(0);
  });

  it('should not create an INTRADAY BUY order when position size is zero', () => {
    const strategy: Strategy = {
      id: 'intraday-zero-quantity-test',
      name: 'NIFTY Intraday Risk Test',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 1000 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 1,
        high: close + 200,
        low: close - 200,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 1049,
      high: 1250,
      low: 850,
      close: 1050,
      volume: 1500
    });

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('WAIT');

    expect(paperTradingService.orders).toHaveLength(0);

    expect(paperTradingService.positions).toHaveLength(0);
  });

  it('should not create an INTRADAY BUY order when risk per trade is zero', () => {
    const strategy: Strategy = {
      id: 'intraday-zero-risk-test',
      name: 'NIFTY Intraday Zero Risk',
      instrument: 'NIFTY50',
      timeframe: '15m',
      status: 'Active',
      type: 'INTRADAY',
      riskManagement: {
        riskPerTrade: 0,
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 149.5,
      high: 151,
      low: 149,
      close: 150,
      volume: 1500
    });

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('WAIT');
    expect(paperTradingService.orders).toHaveLength(0);
    expect(paperTradingService.positions).toHaveLength(0);
  });

  it('should not create another INTRADAY BUY order when a LONG position already exists', () => {
    const strategy: Strategy = {
      id: 'intraday-duplicate-position-test',
      name: 'NIFTY Intraday Duplicate Position',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 149.5,
      high: 151,
      low: 149,
      close: 150,
      volume: 1500
    });

    // First BUY creates the position.
    const firstSignal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(firstSignal).toBe('BUY');
    expect(paperTradingService.orders).toHaveLength(1);
    expect(paperTradingService.positions).toHaveLength(1);

    // Same BUY setup arrives again while already LONG.
    const secondSignal = service.run(
      strategy,
      candles,
      'LONG'
    );

    expect(secondSignal).not.toBe('BUY');

    // No second BUY order should be created.
    expect(
      paperTradingService.orders.filter(
        order => order.side === 'BUY'
      )
    ).toHaveLength(1);

    expect(paperTradingService.positions).toHaveLength(1);
  });

  it('should not create an INTRADAY BUY order when capital cannot afford one share', () => {
    const strategy: Strategy = {
      id: 'intraday-insufficient-capital-test',
      name: 'NIFTY Intraday Insufficient Capital',
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

    const candles: MarketCandle[] = [];

    for (let index = 0; index < 50; index++) {
      const close = 100 + index;

      candles.push({
        timestamp: index + 1,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000
      });
    }

    candles.push({
      timestamp: 51,
      open: 149.5,
      high: 151,
      low: 149,
      close: 150,
      volume: 1500
    });

    // Simulate an account that cannot afford one share.
    (
      paperTradingService as unknown as {
        _capital: number;
      }
    )._capital = 100;

    const signal = service.run(
      strategy,
      candles,
      'NONE'
    );

    expect(signal).toBe('WAIT');
    expect(paperTradingService.orders).toHaveLength(0);
    expect(paperTradingService.positions).toHaveLength(0);
  });

  it('should not create a SELL order when no actual position exists', () => {
    const strategy: Strategy = {
      id: 'sell-without-position-test',
      name: 'NIFTY Sell Without Position',
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

    const candles: MarketCandle[] = [
      {
        timestamp: 1,
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000
      }
    ];

    vi.spyOn(
      strategyService,
      'evaluateStrategy'
    ).mockReturnValue('SELL');

    const signal = service.run(
      strategy,
      candles,
      'LONG'
    );

    expect(signal).toBe('SELL');

    expect(paperTradingService.orders).toHaveLength(0);
    expect(paperTradingService.positions).toHaveLength(0);
    expect(paperTradingService.trades).toHaveLength(0);
  });
});