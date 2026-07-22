import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrategyHome } from './strategy-home';

describe('StrategyHome', () => {
  let component: StrategyHome;
  let fixture: ComponentFixture<StrategyHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyHome],
    }).compileComponents();

    fixture = TestBed.createComponent(StrategyHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
