import { describe, expect, it } from 'vitest';

import { PositionSizingService } from './position-sizing';

describe('PositionSizingSerivce', () => {
  const service = new PositionSizingService();

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate position quantity based on risk', () => {
    const quantity = service.calculateQuantity(
      100000,
      1,
      500,
      490
    );

    expect(quantity).toBe(100);
  });

  it('should return zero quantity when entry and stop loss are the same', () => {
    const quantity = service.calculateQuantity(
      100000,
      1,
      500,
      500
    );

    expect(quantity).toBe(0);
  });

  it('should calculate smaller quantity for lower risk', () => {
    const quantity = service.calculateQuantity(
      100000,
      0.5,
      500,
      490
    );

    expect(quantity).toBe(50);
  });

  it('should return zero quantity when risk percentage is zero', () => {
    const quantity = service.calculateQuantity(
      100000,
      0,
      500,
      490
    );

    expect(quantity).toBe(0);
  });

  it('should return zero quantity when capital is zero', () => {
    const quantity = service.calculateQuantity(
      0,
      1,
      500,
      490
    );

    expect(quantity).toBe(0);
  });

  it('should return zero quantity when risk percentage is negative', () => {
    const quantity = service.calculateQuantity(
      100000,
      -1,
      500,
      490
    );

    expect(quantity).toBe(0);
  });

  it('should return zero quantity when entry price is zero', () => {
    const quantity = service.calculateQuantity(
      100000,
      1,
      0,
      490
    );

    expect(quantity).toBe(0);
  });

  it('should return zero quantity when entry price is negative', () => {
    const quantity = service.calculateQuantity(
      100000,
      1,
      -500,
      490
    );

    expect(quantity).toBe(0);
  });

  it('should return zero quantity when stop loss price is negative', () => {
    const quantity = service.calculateQuantity(
      100000,
      1,
      500,
      -490
    );

    expect(quantity).toBe(0);
  });

  it('should limit quantity to available capital', () => {
    const quantity = service.calculateQuantity(
      100000,
      1,
      500,
      499
    );

    expect(quantity).toBe(200);
  });
});