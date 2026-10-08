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
            name: 'NIFTY Intraday Trend',
            instrument: 'NIFTY50',
            timeframe: '15m',
            status: 'Active',
            type: 'INTRADAY',
            riskManagement: {
                riskPerTrade: 0.5,
                stopLossPercent: 0,
                takeProfitPercent: 0,
                maxDailyLossPercent: 1.5,
                maxOpenTrades: 1,

                emaFastPeriod: 20,
                emaSlowPeriod: 50,
                volumePeriod: 20,
                volumeMultiplier: 1.2,
                atrPeriod: 14,
                atrMultiplier: 1.5,
                rewardRiskRatio: 2
            }
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

    evaluateEmaTrend(
        candles: MarketCandle[],
        fastPeriod: number,
        slowPeriod: number
    ): boolean {
        const fastEma =
            this.indicatorService.calculateLatestEma(
                candles,
                fastPeriod
            );

        const slowEma =
            this.indicatorService.calculateLatestEma(
                candles,
                slowPeriod
            );

        if (
            fastEma === null ||
            slowEma === null
        ) {
            return false;
        }

        return fastEma > slowEma;
    }

    evaluateTrendEntry(
        candles: MarketCandle[]
    ): boolean {
        const emaTrend =
            this.evaluateEmaTrend(candles, 20, 50);

        if (!emaTrend) {
            return false;
        }

        return this.evaluatePriceVsEma(
            candles,
            20
        ) === 'BUY';
    }

    isBullishCandle(
        candle: MarketCandle
    ): boolean {
        return candle.close > candle.open;
    }

    isVolumeConfirmed(
        candles: MarketCandle[],
        period: number = 20,
        multiplier: number = 1.2
    ): boolean {
        if (candles.length <= period) {
            return false;
        }

        const currentCandle =
            candles[candles.length - 1];

        const previousCandles =
            candles.slice(
                candles.length - period - 1,
                candles.length - 1
            );

        const averageVolume =
            this.indicatorService.calculateAverageVolume(
                previousCandles,
                period
            );

        if (averageVolume === null) {
            return false;
        }

        const currentVolume =
            currentCandle.volume ?? 0;

        return currentVolume >=
            averageVolume * multiplier;
    }

    evaluateIntradayEntry(
        strategy: Strategy,
        candles: MarketCandle[]
    ): boolean {
        if (candles.length === 0) {
            return false;
        }

        const riskManagement =
            strategy.riskManagement;

        const emaFastPeriod =
            riskManagement?.emaFastPeriod ?? 20;

        const emaSlowPeriod =
            riskManagement?.emaSlowPeriod ?? 50;

        const volumePeriod =
            riskManagement?.volumePeriod ?? 20;

        const volumeMultiplier =
            riskManagement?.volumeMultiplier ?? 1.2;

        const trendConfirmed =
            this.evaluateEmaTrend(
                candles,
                emaFastPeriod,
                emaSlowPeriod
            );

        if (!trendConfirmed) {
            return false;
        }

        const priceConfirmed =
            this.evaluatePriceVsEma(
                candles,
                emaFastPeriod
            ) === 'BUY';

        if (!priceConfirmed) {
            return false;
        }

        const currentCandle =
            candles[candles.length - 1];

        const bullishCandle =
            this.isBullishCandle(currentCandle);

        if (!bullishCandle) {
            return false;
        }

        return this.isVolumeConfirmed(
            candles,
            volumePeriod,
            volumeMultiplier
        );
    }



    evaluateIntradaySetup(
        strategy: Strategy,
        candles: MarketCandle[]
    ): {
        entryPrice: number;
        stopLossPrice: number;
        takeProfitPrice: number;
    } | null {
        if (!this.evaluateIntradayEntry(strategy, candles)) {
            return null;
        }

        const currentCandle =
            candles[candles.length - 1];

        const entryPrice = currentCandle.close;

        const atrPeriod =
            strategy.riskManagement?.atrPeriod ?? 14;

        const atrMultiplier =
            strategy.riskManagement?.atrMultiplier ?? 1.5;

        const rewardRiskRatio =
            strategy.riskManagement?.rewardRiskRatio ?? 2;

        const atr =
            this.indicatorService.calculateAtr(
                candles,
                atrPeriod
            );

        if (atr === null) {
            return null;
        }

        const stopLossPrice =
            this.calculateAtrStopLoss(
                entryPrice,
                atr,
                atrMultiplier
            );

        if (stopLossPrice <= 0) {
            return null;
        }

        const takeProfitPrice =
            this.calculateTakeProfit(
                entryPrice,
                stopLossPrice,
                rewardRiskRatio
            );

        if (takeProfitPrice <= entryPrice) {
            return null;
        }

        return {
            entryPrice,
            stopLossPrice,
            takeProfitPrice
        };
    }

    calculateAtrStopLoss(
        entryPrice: number,
        atr: number,
        multiplier: number = 1.5
    ): number {
        if (
            entryPrice <= 0 ||
            atr <= 0 ||
            multiplier <= 0
        ) {
            return 0;
        }

        return entryPrice - (atr * multiplier);
    }

    calculateTakeProfit(
        entryPrice: number,
        stopLossPrice: number,
        rewardRiskRatio: number = 2
    ): number {
        if (
            entryPrice <= 0 ||
            stopLossPrice <= 0 ||
            rewardRiskRatio <= 0 ||
            stopLossPrice >= entryPrice
        ) {
            return 0;
        }

        const riskPerShare =
            entryPrice - stopLossPrice;

        return entryPrice +
            (riskPerShare * rewardRiskRatio);
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

            if (strategy.type === 'INTRADAY') {
                return this.evaluateIntradayEntry(
                    strategy,
                    candles
                )
                    ? 'BUY'
                    : 'WAIT';
            }

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
