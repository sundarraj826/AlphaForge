import { TestBed } from '@angular/core/testing';

import { MarketHistoryService } from './market-history';

describe('MarketHistoryService', () => {
  let service: MarketHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarketHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
