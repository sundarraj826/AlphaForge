import { TestBed } from '@angular/core/testing';

import { TradingCostService } from './trading-cost';
import { TradingCostConfig } from '../models/trading-cost.model';

describe('TradingCostService', () => {

  let service: TradingCostService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TradingCostService
      ]
    });

    service = TestBed.inject(TradingCostService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate Zerodha brokerage correctly for each executed order', () => {
    const config: TradingCostConfig = {
      market: 'INDIAN_EQUITY_INTRADAY',
      exchange: 'NSE',
      broker: 'ZERODHA',
      brokeragePercent: 0.03,
      brokerageFixed: 20
    };

    const result = service.calculate(
      config,
      100,
      110,
      10
    );


    expect(result).toBe(0.63);
  });

  it('should cap Zerodha brokerage at ₹20 per executed order', () => {
    const config: TradingCostConfig = {
      market: 'INDIAN_EQUITY_INTRADAY',
      exchange: 'NSE',
      broker: 'ZERODHA',
      brokeragePercent: 0.03,
      brokerageFixed: 20
    };

    const result = service.calculate(
      config,
      10000,
      11000,
      100
    );

    expect(result).toBe(40);
  });

  it('should calculate STT at 0.025% on the sell side', () => {
    const config: TradingCostConfig = {
      market: 'INDIAN_EQUITY_INTRADAY',
      exchange: 'NSE',
      broker: 'ZERODHA',
      sttPercent: 0.025
    };

    const result = service.calculate(
      config,
      100,
      1000,
      1000
    );

    expect(result).toBe(250);
  });

  it('should calculate SEBI charges at ₹10 per crore of turnover', () => {
    const config: TradingCostConfig = {
      market: 'INDIAN_EQUITY_INTRADAY',
      exchange: 'NSE',
      broker: 'ZERODHA',
      sebiChargesPercent: 0.0001
    };

    const result = service.calculate(
      config,
      100,
      1000,
      10000
    );

    expect(result).toBe(11);
  });

  it('should calculate stamp duty at 0.003% on the buy side', () => {
    const config: TradingCostConfig = {
      market: 'INDIAN_EQUITY_INTRADAY',
      exchange: 'NSE',
      broker: 'ZERODHA',
      stampDutyPercent: 0.003
    };

    const result = service.calculate(
      config,
      100,
      110,
      1000
    );

    expect(result).toBe(3);
  });

  it('should calculate GST at 18% on applicable charges', () => {
    const config: TradingCostConfig = {
      market: 'INDIAN_EQUITY_INTRADAY',
      exchange: 'NSE',
      broker: 'ZERODHA',
      brokeragePercent: 0.03,
      brokerageFixed: 20,
      exchangeTransactionPercent: 0.00307,
      sebiChargesPercent: 0.0001,
      gstPercent: 18
    };

    const result = service.calculate(
      config,
      100,
      110,
      1000
    );

    expect(result).toBeCloseTo(55.05526, 4);
  });

  it('should calculate complete NSE intraday trading costs', () => {
    const config: TradingCostConfig = {
      market: 'INDIAN_EQUITY_INTRADAY',
      exchange: 'NSE',
      broker: 'ZERODHA',
      brokeragePercent: 0.03,
      brokerageFixed: 20,
      sttPercent: 0.025,
      exchangeTransactionPercent: 0.00307,
      sebiChargesPercent: 0.0001,
      stampDutyPercent: 0.003,
      gstPercent: 18
    };

    const result = service.calculate(
      config,
      100,
      110,
      1000
    );

    expect(result).toBeCloseTo(86.05526, 4);
  });

});