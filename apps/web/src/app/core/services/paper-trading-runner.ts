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

        /*
         * Manage existing LONG position
         */
        if (
            positionSide === 'LONG' &&
            candles.length > 0
        ) {
            const currentPrice =
                candles[candles.length - 1].close;

            this._paperTradingService.updatePositionPrice(
                strategy.instrument,
                currentPrice
            );

            const position =
                this._paperTradingService.positions.find(
                    currentPosition =>
                        currentPosition.symbol === strategy.instrument &&
                        currentPosition.side === 'LONG'
                );

            if (position) {

                /*
                 * INTRADAY strategy
                 * Use ATR-based Stop Loss and 2R Take Profit
                 */
                if (strategy.type === 'INTRADAY') {

                    const setup =
                        this._strategyService.evaluateIntradaySetup(
                            strategy,
                            candles
                        );

                    if (setup) {

                        const stopLossHit =
                            currentPrice <= setup.stopLossPrice;

                        const takeProfitHit =
                            currentPrice >= setup.takeProfitPrice;

                        if (
                            stopLossHit ||
                            takeProfitHit
                        ) {
                            const order =
                                this._paperTradingService.placeOrder(
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
                    }
                }

                /*
                 * Generic strategy
                 * Use existing percentage-based Stop Loss
                 * and Take Profit logic.
                 */
                else {

                    const stopLossPercent =
                        strategy.riskManagement?.stopLossPercent ?? 0;

                    const takeProfitPercent =
                        strategy.riskManagement?.takeProfitPercent ?? 0;

                    const stopLossPrice =
                        position.entryPrice *
                        (1 - stopLossPercent / 100);

                    const takeProfitPrice =
                        position.entryPrice *
                        (1 + takeProfitPercent / 100);

                    const stopLossHit =
                        stopLossPercent > 0 &&
                        currentPrice <= stopLossPrice;

                    const takeProfitHit =
                        takeProfitPercent > 0 &&
                        currentPrice >= takeProfitPrice;

                    if (
                        stopLossHit ||
                        takeProfitHit
                    ) {
                        const order =
                            this._paperTradingService.placeOrder(
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
                }
            }
        }

        /*
         * Open new LONG position
         */
        if (
            signal === 'BUY' &&
            positionSide === 'NONE' &&
            candles.length > 0
        ) {
            const currentPrice =
                candles[candles.length - 1].close;

            let entryPrice = currentPrice;
            let stopLossPrice = currentPrice;

            /*
             * INTRADAY strategy
             *
             * Entry, Stop Loss and Take Profit
             * are determined by the strategy setup.
             */
            if (strategy.type === 'INTRADAY') {
                const setup =
                    this._strategyService.evaluateIntradaySetup(
                        strategy,
                        candles
                    );

                if (!setup) {
                    return 'WAIT';
                }

                entryPrice = setup.entryPrice;
                stopLossPrice = setup.stopLossPrice;
            } else {
                /*
                 * Existing generic strategy
                 * continues to use percentage-based Stop Loss.
                 */
                const stopLossPercent =
                    strategy.riskManagement?.stopLossPercent ?? 0;

                stopLossPrice =
                    stopLossPercent > 0
                        ? entryPrice *
                        (1 - stopLossPercent / 100)
                        : entryPrice;
            }

            const riskPercent =
                strategy.riskManagement?.riskPerTrade ?? 0;

            const quantity =
                this._positionSizingService.calculateQuantity(
                    this._paperTradingService.capital,
                    riskPercent,
                    entryPrice,
                    stopLossPrice
                );

            if (quantity <= 0) {
                return 'WAIT';
            }

            const order =
                this._paperTradingService.placeOrder(
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
         * Strategy-generated SELL signal
         */
        if (
            signal === 'SELL' &&
            positionSide === 'LONG' &&
            candles.length > 0
        ) {
            const currentPrice =
                candles[candles.length - 1].close;

            const position =
                this._paperTradingService.positions.find(
                    currentPosition =>
                        currentPosition.symbol === strategy.instrument &&
                        currentPosition.side === 'LONG'
                );

            if (!position) {
                return signal;
            }

            const order =
                this._paperTradingService.placeOrder(
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
        }

        return signal;
    }
}