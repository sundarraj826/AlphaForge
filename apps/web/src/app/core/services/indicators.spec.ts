import { TestBed } from '@angular/core/testing';

import { IndicatorService } from './indicators';

describe('Indicators', () => {
  let service: IndicatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndicatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
