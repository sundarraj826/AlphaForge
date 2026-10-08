import { Service } from '@angular/core';
import { PaperOrder } from '../models/paper-order.model';
import { PaperPosition } from '../models/paper-position.model';
import { PaperTrade } from '../models/paper-trade.model';

@Service()
export class PaperTradingService {

    private readonly _orders: PaperOrder[] = [];
    private readonly _positions: PaperPosition[] = [];
    private readonly _trades: PaperTrade[] = [];
    private _capital = 100000;

    get capital(): number {
        return this._capital;
    }

    get orders(): PaperOrder[] {
        return [...this._orders];
    }

    get positions(): PaperPosition[] {
        return [...this._positions];
    }

    get trades(): PaperTrade[] {
        return [...this._trades];
    }

    placeOrder(
        symbol: string,
        side: 'BUY' | 'SELL',
        quantity: number,
        requestedPrice: number
    ): PaperOrder {

        const order: PaperOrder = {
            id: crypto.randomUUID(),
            symbol,
            side,
            quantity,
            requestedPrice,
            fillPrice: 0,
            status: 'PENDING',
            createdAt: Date.now()
        };

        this._orders.push(order);

        return order;
    }

    fillOrder(
        orderId: string,
        fillPrice: number
    ): PaperOrder | null {

        const order = this._orders.find(
            currentOrder => currentOrder.id === orderId
        );

        if (!order || order.status !== 'PENDING') {
            return null;
        }

        order.fillPrice = fillPrice;
        order.status = 'FILLED';
        order.filledAt = Date.now();

        return order;
    }

    openPosition(order: PaperOrder): PaperPosition | null {

        if (
            order.status !== 'FILLED' ||
            order.side !== 'BUY' ||
            order.quantity <= 0 ||
            order.fillPrice <= 0
        ) {
            return null;
        }

        const position: PaperPosition = {
            symbol: order.symbol,
            side: 'LONG',
            quantity: order.quantity,
            entryPrice: order.fillPrice,
            currentPrice: order.fillPrice,
            unrealizedProfitLoss: 0,
            openedAt: order.filledAt ?? Date.now()
        };

        this._positions.push(position);

        return position;
    }

    updatePositionPrice(
        symbol: string,
        currentPrice: number
    ): void {

        const position = this._positions.find(
            currentPosition =>
                currentPosition.symbol === symbol &&
                currentPosition.side === 'LONG'
        );

        if (!position) {
            return;
        }

        position.currentPrice = currentPrice;

        position.unrealizedProfitLoss =
            (currentPrice - position.entryPrice) *
            position.quantity;
    }

    closePosition(
        symbol: string,
        exitPrice: number
    ): number | null {

        if (exitPrice <= 0) {
            return null;
        }

        const positionIndex = this._positions.findIndex(
            position =>
                position.symbol === symbol &&
                position.side === 'LONG'
        );

        if (positionIndex === -1) {
            return null;
        }

        const position = this._positions[positionIndex];

        const realizedProfitLoss =
            (exitPrice - position.entryPrice) *
            position.quantity;

        const closedAt = Date.now();

        const trade: PaperTrade = {
            symbol: position.symbol,
            quantity: position.quantity,
            entryPrice: position.entryPrice,
            exitPrice,
            profitLoss: realizedProfitLoss,
            openedAt: position.openedAt,
            closedAt
        };

        this._trades.push(trade);

        this._capital += realizedProfitLoss;

        this._positions.splice(positionIndex, 1);

        return realizedProfitLoss;
    }
}