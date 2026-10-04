import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BacktestHome } from './backtest';

describe('Backtest', () => {
  let component: BacktestHome;
  let fixture: ComponentFixture<BacktestHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BacktestHome],
    }).compileComponents();

    fixture = TestBed.createComponent(BacktestHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
