import { describe, expect, it } from 'vitest';
import { PaperTradingService } from './paper-trading';

describe('PaperTradingService', () => {

  it('should create a paper order', () => {
    const service = new PaperTradingService();

    const order = service.placeOrder(
      'RELIANCE',
      'BUY',
      200,
      1250
    );

    expect(order.symbol).toBe('RELIANCE');
    expect(order.side).toBe('BUY');
    expect(order.quantity).toBe(200);
    expect(order.requestedPrice).toBe(1250);
    expect(order.status).toBe('PENDING');
  });

  it('should fill a pending order', () => {
    const service = new PaperTradingService();

    const order = service.placeOrder(
      'RELIANCE',
      'BUY',
      200,
      1250
    );

    const filledOrder = service.fillOrder(
      order.id,
      1251
    );

    expect(filledOrder).not.toBeNull();
    expect(filledOrder?.status).toBe('FILLED');
    expect(filledOrder?.fillPrice).toBe(1251);
  });

  it('should open a virtual position from a filled order', () => {
    const service = new PaperTradingService();

    const order = service.placeOrder(
      'RELIANCE',
      'BUY',
      200,
      1250
    );

    const filledOrder = service.fillOrder(
      order.id,
      1251
    );

    expect(filledOrder).not.toBeNull();

    const position = service.openPosition(filledOrder!);

    expect(position).not.toBeNull();
    expect(position?.symbol).toBe('RELIANCE');
    expect(position?.side).toBe('LONG');
    expect(position?.quantity).toBe(200);
    expect(position?.entryPrice).toBe(1251);
    expect(position?.unrealizedProfitLoss).toBe(0);
  });

  it('should calculate unrealized profit and loss', () => {
    const service = new PaperTradingService();

    const order = service.placeOrder(
      'RELIANCE',
      'BUY',
      200,
      1250
    );

    const filledOrder = service.fillOrder(
      order.id,
      1251
    );

    const position = service.openPosition(filledOrder!);

    expect(position).not.toBeNull();

    service.updatePositionPrice(
      'RELIANCE',
      1271
    );

    expect(
      service.positions[0].unrealizedProfitLoss
    ).toBe(4000);
  });

  it('should close a virtual position and calculate realized profit', () => {
    const service = new PaperTradingService();

    const order = service.placeOrder(
      'RELIANCE',
      'BUY',
      200,
      1250
    );

    const filledOrder = service.fillOrder(
      order.id,
      1251
    );

    service.openPosition(filledOrder!);

    const realizedProfitLoss = service.closePosition(
      'RELIANCE',
      1275
    );

    expect(realizedProfitLoss).toBe(4800);
    expect(service.positions).toHaveLength(0);
    expect(service.trades).toHaveLength(1);

    expect(service.trades[0]).toMatchObject({
      symbol: 'RELIANCE',
      quantity: 200,
      entryPrice: 1251,
      exitPrice: 1275,
      profitLoss: 4800
    });
  });

  it('should update capital after closing a profitable position', () => {
    const service = new PaperTradingService();

    expect(service.capital).toBe(100000);

    const order = service.placeOrder(
      'RELIANCE',
      'BUY',
      200,
      1250
    );

    const filledOrder = service.fillOrder(
      order.id,
      1251
    );

    service.openPosition(filledOrder!);

    service.closePosition(
      'RELIANCE',
      1275
    );

    expect(service.capital).toBe(104800);
  });

  it('should not close a position when exit price is zero', () => {
    const service = new PaperTradingService();
    const order = service.placeOrder(
      'NIFTY50',
      'BUY',
      10,
      100
    );

    service.fillOrder(order.id, 100);
    service.openPosition(order);

    const initialCapital = service.capital;

    const result = service.closePosition(
      'NIFTY50',
      0
    );

    expect(result).toBeNull();
    expect(service.positions).toHaveLength(1);
    expect(service.trades).toHaveLength(0);
    expect(service.capital).toBe(initialCapital);
  });

  it('should not open a position from an invalid BUY quantity', () => {
    const service = new PaperTradingService();
    const order = service.placeOrder(
      'NIFTY50',
      'BUY',
      0,
      100
    );

    service.fillOrder(order.id, 100);

    const position = service.openPosition(order);

    expect(position).toBeNull();
    expect(service.positions).toHaveLength(0);
  });

  it('should not open a position from an invalid BUY price', () => {
    const service = new PaperTradingService();

    const order = service.placeOrder(
      'NIFTY50',
      'BUY',
      10,
      100
    );

    service.fillOrder(order.id, 0);

    const position = service.openPosition(order);

    expect(position).toBeNull();
    expect(service.positions).toHaveLength(0);
  });
});