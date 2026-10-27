import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StrategyHome } from './strategy-home';

describe('StrategyHome', () => {
  let component: StrategyHome;
  let fixture: ComponentFixture<StrategyHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyHome],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(StrategyHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
