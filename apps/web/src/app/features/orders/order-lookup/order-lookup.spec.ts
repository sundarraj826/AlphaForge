import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderLookup } from './order-lookup';

describe('OrderLookup', () => {
  let component: OrderLookup;
  let fixture: ComponentFixture<OrderLookup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderLookup],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderLookup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
