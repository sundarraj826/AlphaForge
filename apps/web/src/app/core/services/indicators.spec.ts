import { TestBed } from '@angular/core/testing';

import { IndicatorService } from './indicators';
import { MarketCandle } from '../models/market-candle.model';

describe('Indicators', () => {
  let service: IndicatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndicatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate ATR correctly', () => {
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
        high: 115,
        low: 100,
        close: 110,
        volume: 1000
      },
      {
        timestamp: 3,
        open: 110,
        high: 120,
        low: 105,
        close: 115,
        volume: 1000
      }
    ];

    const atr = service.calculateAtr(candles, 2);

    expect(atr).toBe(15);
  });

  it('should return null when there are not enough candles for ATR', () => {
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
        high: 115,
        low: 100,
        close: 110,
        volume: 1000
      }
    ];

    const atr = service.calculateAtr(candles, 2);

    expect(atr).toBeNull();
  });

  it('should calculate average volume correctly', () => {
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
        high: 115,
        low: 100,
        close: 110,
        volume: 1200
      },
      {
        timestamp: 3,
        open: 110,
        high: 120,
        low: 105,
        close: 115,
        volume: 1400
      }
    ];

    const averageVolume =
      service.calculateAverageVolume(candles, 3);

    expect(averageVolume).toBe(1200);
  });

  it('should return null when there are not enough candles for average volume', () => {
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
        high: 115,
        low: 100,
        close: 110,
        volume: 1200
      }
    ];

    const averageVolume =
      service.calculateAverageVolume(candles, 3);

    expect(averageVolume).toBeNull();
  });
});
