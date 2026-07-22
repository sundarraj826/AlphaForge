import { TestBed } from '@angular/core/testing';

import { Strategy } from './strategy';

describe('Strategy', () => {
  let service: Strategy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Strategy);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
