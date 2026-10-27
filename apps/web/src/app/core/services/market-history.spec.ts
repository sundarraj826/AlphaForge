import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MarketHistoryService } from './market-history';

describe('MarketHistoryService', () => {
  let service: MarketHistoryService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketHistoryService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('includes the explicit instrument identifier in Upstox historical requests', async () => {
    const loadPromise = service.loadCandles({
      source: 'upstox',
      instrument: 'NIFTY50',
      timeframe: '15m',
      fromDate: '2026-10-23',
      toDate: '2026-10-23',
    });

    const request = httpTestingController.expectOne(
      request => {
        const url = new URL(request.urlWithParams);
        return (
          url.origin === 'http://localhost:3000' &&
          url.pathname === '/api/market/candles' &&
          url.searchParams.get('source') === 'upstox' &&
          url.searchParams.get('instrument') === 'NIFTY50' &&
          url.searchParams.get('timeframe') === '15m' &&
          url.searchParams.get('fromDate') === '2026-10-23' &&
          url.searchParams.get('toDate') === '2026-10-23'
        );
      },
    );
    request.flush({
      status: 'success',
      source: 'upstox',
      data: { candles: [] },
    });
    await loadPromise;

    expect(service.error()).toBeNull();
  });

  it('surfaces the API message for an unsupported historical instrument', async () => {
    const loadPromise = service.loadCandles({
      source: 'upstox',
      instrument: 'XAU/USD',
      timeframe: '15m',
      fromDate: '2026-10-23',
      toDate: '2026-10-23',
    });
    const request = httpTestingController.expectOne(
      request =>
        new URL(request.urlWithParams).searchParams.get('instrument') ===
        'XAU/USD',
    );
    request.flush(
      { status: 'error', message: 'Unsupported historical instrument.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await loadPromise;

    expect(service.error()).toBe('Unsupported historical instrument.');
  });

  it('rejects an Upstox request without a timeframe', async () => {
    await service.loadCandles({
      source: 'upstox',
      instrument: 'NIFTY50',
      fromDate: '2026-10-23',
      toDate: '2026-10-23',
    });

    expect(service.error()).toContain('timeframe');
    httpTestingController.expectNone(
      request => request.url === 'http://localhost:3000/api/market/candles',
    );
  });
});
