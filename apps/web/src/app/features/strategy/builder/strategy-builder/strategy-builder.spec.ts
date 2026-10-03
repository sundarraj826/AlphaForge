import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrategyBuilder } from './strategy-builder';

describe('StrategyBuilder', () => {
  let component: StrategyBuilder;
  let fixture: ComponentFixture<StrategyBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyBuilder],
    }).compileComponents();

    fixture = TestBed.createComponent(StrategyBuilder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
