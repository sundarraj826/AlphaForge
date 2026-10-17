
import { inject, Service } from '@angular/core';

import { MarketCandle } from '../models/market-candle.model';
import { PositionSide } from '../models/position-side.model';
import { Strategy } from '../models/strategy.model';

import { PaperTradingService } from './paper-trading';
import { StrategyService } from './strategy';
import { PositionSizingService } from './position-sizing';

@Service()
export class PaperTradingRunnerService {

    private readonly _strategyService = inject(StrategyService);
    private readonly _paperTradingService = inject(PaperTradingService);
    private readonly _positionSizingService = inject(PositionSizingService);

    run(
        strategy: Strategy,
        candles: MarketCandle[],
        positionSide: PositionSide
    ): 'BUY' | 'SELL' | 'WAIT' {

        const signal = this._strategyService.evaluateStrategy(
            strategy,
            candles,
            positionSide
        );

        if (candles.length === 0) {
            return 'WAIT';
        }

        const currentCandle = candles[candles.length - 1];
        const currentPrice = currentCandle.close;

        /*
         * Manage an existing LONG position.
         */
        if (positionSide === 'LONG') {

            this._paperTradingService.updatePositionPrice(
                strategy.instrument,
                currentPrice
            );

            const position = this._paperTradingService.positions.find(
                currentPosition =>
                    currentPosition.symbol === strategy.instrument &&
                    currentPosition.side === 'LONG'
            );

            if (position) {

                let stopLossPrice = 0;
                let takeProfitPrice = 0;

                if (strategy.type === 'INTRADAY') {

                    const setup = this._strategyService.evaluateIntradaySetup(
                        strategy,
                        candles
                    );

                    if (setup) {
                        stopLossPrice = setup.stopLossPrice;
                        takeProfitPrice = setup.takeProfitPrice;
                    }

                } else {

                    const stopLossPercent =
                        strategy.riskManagement?.stopLossPercent ?? 0;

                    const takeProfitPercent =
                        strategy.riskManagement?.takeProfitPercent ?? 0;

                    stopLossPrice = stopLossPercent > 0
                        ? position.entryPrice * (1 - stopLossPercent / 100)
                        : 0;

                    takeProfitPrice = takeProfitPercent > 0
                        ? position.entryPrice * (1 + takeProfitPercent / 100)
                        : 0;
                }

                const stopLossHit =
                    stopLossPrice > 0 &&
                    currentCandle.low <= stopLossPrice;

                const takeProfitHit =
                    takeProfitPrice > 0 &&
                    currentCandle.high >= takeProfitPrice;

                /*
                 * If both levels are touched in the same candle,
                 * assume stop-loss occurs first.
                 */
                if (stopLossHit || takeProfitHit) {

                    const exitPrice = stopLossHit
                        ? stopLossPrice
                        : takeProfitPrice;

                    const order = this._paperTradingService.placeOrder(
                        strategy.instrument,
                        'SELL',
                        position.quantity,
                        exitPrice
                    );

                    this._paperTradingService.fillOrder(
                        order.id,
                        exitPrice
                    );

                    this._paperTradingService.closePosition(
                        strategy.instrument,
                        exitPrice
                    );

                    return 'SELL';
                }
            }
        }

        /*
         * Open a new LONG position.
         */
        if (signal === 'BUY' && positionSide === 'NONE') {

            let entryPrice = currentPrice;
            let stopLossPrice = currentPrice;

            if (strategy.type === 'INTRADAY') {

                const setup = this._strategyService.evaluateIntradaySetup(
                    strategy,
                    candles
                );

                if (!setup) {
                    return 'WAIT';
                }

                entryPrice = setup.entryPrice;
                stopLossPrice = setup.stopLossPrice;

            } else {

                const stopLossPercent =
                    strategy.riskManagement?.stopLossPercent ?? 0;

                stopLossPrice = stopLossPercent > 0
                    ? entryPrice * (1 - stopLossPercent / 100)
                    : entryPrice;
            }

            const riskPercent =
                strategy.riskManagement?.riskPerTrade ?? 0;

            const quantity = this._positionSizingService.calculateQuantity(
                this._paperTradingService.capital,
                riskPercent,
                entryPrice,
                stopLossPrice
            );

            if (quantity <= 0) {
                return 'WAIT';
            }

            const order = this._paperTradingService.placeOrder(
                strategy.instrument,
                'BUY',
                quantity,
                entryPrice
            );

            this._paperTradingService.fillOrder(
                order.id,
                entryPrice
            );

            this._paperTradingService.openPosition(order);

            return 'BUY';
        }

        /*
         * Close an existing position when the strategy generates SELL.
         */
        if (signal === 'SELL' && positionSide === 'LONG') {

            const position = this._paperTradingService.positions.find(
                currentPosition =>
                    currentPosition.symbol === strategy.instrument &&
                    currentPosition.side === 'LONG'
            );

            if (!position) {
                return signal;
            }

            const order = this._paperTradingService.placeOrder(
                strategy.instrument,
                'SELL',
                position.quantity,
                currentPrice
            );

            this._paperTradingService.fillOrder(
                order.id,
                currentPrice
            );

            this._paperTradingService.closePosition(
                strategy.instrument,
                currentPrice
            );

            return 'SELL';
        }

        return signal;
    }
}
