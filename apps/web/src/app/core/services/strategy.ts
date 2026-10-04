import { inject, Service, signal } from '@angular/core';

import { Strategy } from '../models/strategy.model';
import { MarketCandle } from '../models/market-candle.model';
import { PositionSide } from '../models/position-side.model';

import { IndicatorService } from './indicators';
import { EntryCondition } from '../models/entry-condition.model';
import { ExitCondition } from '../models/exit-condition.model';

@Service()
export class StrategyService {

    readonly indicatorService = inject(IndicatorService);

    private readonly _strategies = signal<Strategy[]>([
        {
            id: '1',
            name: 'Gold EMA Cross',
            instrument: 'XAU/USD',
            timeframe: '15m',
            status: 'Active',
            entryConditions: [
                {
                    indicator: 'Price',
                    operator: '>',
                    value: 99
                }
            ],

            exitConditions: [
                {
                    indicator: 'Price',
                    operator: '<',
                    value: 111
                }
            ]
        },
        {
            id: '2',
            name: 'BTC Breakout',
            instrument: 'BTC/USD',
            timeframe: '1H',
            status: 'Inactive'
        },
        {
            id: '3',
            name: 'Nifty Swing',
            instrument: 'NIFTY50',
            timeframe: '1D',
            status: 'Active'
        }
    ]);

    addStrategy(strategy: Strategy) {

    }

    readonly strategies = this._strategies.asReadonly();

    evaluatePriceVsEma(
        candles: MarketCandle[],
        period: number
    ): 'BUY' | 'SELL' | 'WAIT' {
        const latestEma = this.indicatorService.calculateLatestEma(
            candles,
            period
        );

        if (latestEma === null || candles.length === 0) {
            return 'WAIT';
        }

        const currentPrice = candles[candles.length - 1].close;

        if (currentPrice > latestEma) {
            return 'BUY';
        }

        if (currentPrice < latestEma) {
            return 'SELL';
        }

        return 'WAIT';
    }

    evaluateEntryCondition(
        condition: EntryCondition,
        candles: MarketCandle[]
    ): boolean {
        if (candles.length === 0) {
            return false;
        }


        const currentPrice = candles[candles.length - 1].close;
        const value = Number(condition.value);

        if (condition.indicator === 'Price') {
            if (condition.operator === '>') {
                return currentPrice > value;
            }

            if (condition.operator === '<') {
                return currentPrice < value;
            }
        }

        if (condition.indicator === 'EMA') {
            const period = Number(condition.value);

            const latestEma = this.indicatorService.calculateLatestEma(
                candles,
                period
            );

            if (latestEma === null) {
                return false;
            }

            if (condition.operator === '>') {
                return currentPrice > latestEma;
            }

            if (condition.operator === '<') {
                return currentPrice < latestEma;
            }
        }

        return false;
    }

    evaluateEntryConditions(
        conditions: EntryCondition[],
        candles: MarketCandle[]
    ): boolean {
        if (conditions.length === 0) {
            return false;
        }

        return conditions.every(condition =>
            this.evaluateEntryCondition(condition, candles)
        );
    }

    evaluateStrategy(
        strategy: Strategy,
        candles: MarketCandle[],
        positionSide: PositionSide
    ): 'BUY' | 'SELL' | 'WAIT' {
        if (candles.length === 0) {
            return 'WAIT';
        }

        if (positionSide === 'NONE') {
            const entryConditions = strategy.entryConditions ?? [];

            if (entryConditions.length === 0) {
                return 'WAIT';
            }

            const entryConditionsMet = this.evaluateEntryConditions(
                entryConditions,
                candles
            );

            if (entryConditionsMet) {
                return 'BUY';
            }

            return 'WAIT';
        }

        if (positionSide === 'LONG') {
            const exitConditions = strategy.exitConditions ?? [];

            if (exitConditions.length === 0) {
                return 'WAIT';
            }

            const exitConditionsMet = this.evaluateExitConditions(
                exitConditions,
                candles
            );

            if (exitConditionsMet) {
                return 'SELL';
            }

            return 'WAIT';
        }

        return 'WAIT';
    }

    evaluateExitCondition(
        condition: ExitCondition,
        candles: MarketCandle[]
    ): boolean {
        if (candles.length === 0) {
            return false;
        }

        const currentPrice = candles[candles.length - 1].close;
        const value = Number(condition.value);

        if (condition.indicator === 'Price') {
            if (condition.operator === '>') {
                return currentPrice > value;
            }

            if (condition.operator === '<') {
                return currentPrice < value;
            }
        }

        if (condition.indicator === 'EMA') {
            const period = Number(condition.value);

            const latestEma = this.indicatorService.calculateLatestEma(
                candles,
                period
            );

            if (latestEma === null) {
                return false;
            }

            if (condition.operator === '>') {
                return currentPrice > latestEma;
            }

            if (condition.operator === '<') {
                return currentPrice < latestEma;
            }
        }

        return false;
    }

    evaluateExitConditions(
        conditions: ExitCondition[],
        candles: MarketCandle[]
    ): boolean {
        if (conditions.length === 0) {
            return false;
        }

        return conditions.every(condition =>
            this.evaluateExitCondition(condition, candles)
        );
    }
}
