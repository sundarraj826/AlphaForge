import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketWatch } from './market-watch';

describe('MarketWatch', () => {
  let component: MarketWatch;
  let fixture: ComponentFixture<MarketWatch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketWatch],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketWatch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
