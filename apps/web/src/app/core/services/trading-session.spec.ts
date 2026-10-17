
import { TestBed } from '@angular/core/testing';
import { TradingSessionService } from './trading-session';

describe('TradingSessionService', () => {
  let service: TradingSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TradingSessionService]
    });

    service = TestBed.inject(TradingSessionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should identify the final 15-minute candle of the NSE session', () => {
    const timestamp = new Date(
      '2026-10-12T15:15:00+05:30'
    ).getTime();

    expect(service.isEndOfDay(timestamp)).toBe(true);
  });

  it('should not identify an earlier candle as end of day', () => {
    const timestamp = new Date(
      '2026-10-12T15:00:00+05:30'
    ).getTime();

    expect(service.isEndOfDay(timestamp)).toBe(false);
  });


  it('should accept a valid NSE candle opening time', () => {
    const timestamp = new Date(
      '2026-10-12T09:15:00+05:30'
    ).getTime();

    expect(service.isMarketSession(timestamp)).toBe(true);
  });

  it('should accept the final 15-minute candle opening time', () => {
    const timestamp = new Date(
      '2026-10-12T15:15:00+05:30'
    ).getTime();

    expect(service.isMarketSession(timestamp)).toBe(true);
  });

  it('should reject candles before market opening', () => {
    const timestamp = new Date(
      '2026-10-12T09:00:00+05:30'
    ).getTime();

    expect(service.isMarketSession(timestamp)).toBe(false);
  });

  it('should reject candles after the final candle opening time', () => {
    const timestamp = new Date(
      '2026-10-12T15:30:00+05:30'
    ).getTime();

    expect(service.isMarketSession(timestamp)).toBe(false);
  });

  it('should reject weekend candles', () => {
    const timestamp = new Date(
      '2026-10-17T10:00:00+05:30'
    ).getTime();

    expect(service.isMarketSession(timestamp)).toBe(false);
  });

});
